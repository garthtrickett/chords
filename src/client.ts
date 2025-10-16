// src/client.ts
import "./index.css";
import { html, render } from "lit-html";
import { createActor, fromPromise, type SnapshotFrom } from "xstate";
import { getTransport, Synth, Sequence, start as startAudio } from "tone";
import { treaty } from "@elysiajs/eden";
import type { App } from "./server";
import { appMachine } from "./machine";
import type { SerializableChord } from "../types/database";

const appContainer = document.querySelector<HTMLElement>("#app");
if (!(appContainer instanceof HTMLElement)) {
  throw new Error("App container not found or is not a valid HTML element");
}

type AppSnapshot = SnapshotFrom<typeof appMachine>;

const client = treaty<App>("http://localhost:8080");
const synth = new Synth().toDestination();
const transport = getTransport();
let sequence = new Sequence().start(0);

// --- XSTATE ACTOR & SERVICES ---

const machineWithImplementations = appMachine.provide({
  actors: {
    fetchChords: fromPromise(async () => {
      const { data, error } = await client.chords.get();
      if (error) throw new Error(JSON.stringify(error.value));
      return data || [];
    }),
    saveChord: fromPromise(
      async ({ input }: { input: { name: string; content: string } }) => {
        const { name, content } = input;
        const nameWithContent = `${name}: ${content}`;
        const { error } = await client.chords.post({ name: nameWithContent });
        if (error) throw new Error(JSON.stringify(error.value));
      },
    ),
  },
});

const appActor = createActor(machineWithImplementations).start();

// --- LIT-HTML TEMPLATE ---

const appTemplate = (state: AppSnapshot) => {
  const { context } = state;
  // Use the corrected state matching for the parallel state machine
  const isAudioOn = state.matches({ running: { audio: "on" } });
  const isSaving = state.matches({ running: { saveStatus: "saving" } });

  // --- Shadcn-inspired Tailwind CSS classes ---
  const cardClasses =
    "bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-md";
  const baseInputClasses =
    "flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm ring-offset-zinc-950 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const primaryButtonClasses =
    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-zinc-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-zinc-50 text-zinc-900 hover:bg-zinc-50/90 h-10 px-4 py-2";
  const destructiveButtonClasses =
    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-zinc-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-zinc-50 hover:bg-red-600/90 h-10 px-4 py-2";
  const labelClasses =
    "text-sm font-medium leading-none text-zinc-400 mb-2 block";
  const errorClasses =
    "mt-4 p-4 bg-red-900/20 text-red-400 border border-red-500/50 rounded-md text-sm";

  return html`
    <div class="bg-zinc-950 text-zinc-50 min-h-screen font-sans">
      <div class="container mx-auto p-4 md:p-8 max-w-3xl">
        <header class="text-center mb-8">
          <h1 class="text-4xl font-bold tracking-tight text-zinc-50">
            Live Coder
          </h1>
          <p class="text-zinc-400 mt-2">
            Create, play, and save musical patterns in real-time.
          </p>
        </header>

        <div class=${cardClasses}>
          <textarea
            class="${baseInputClasses} min-h-[120px] font-mono text-lg resize-none w-full"
            .value=${context.currentPattern}
            @input=${(e: Event) =>
              appActor.send({
                type: "UPDATE_PATTERN",
                value: (e.target as HTMLTextAreaElement).value,
              })}
          ></textarea>

          <div
            class="mt-6 flex flex-col sm:flex-row flex-wrap gap-4 items-center justify-center"
          >
            ${!isAudioOn
              ? html`<button
                  class=${primaryButtonClasses}
                  @click=${() => appActor.send({ type: "START_AUDIO" })}
                >
                  Start Audio
                </button>`
              : html`<button
                  class=${destructiveButtonClasses}
                  @click=${() => appActor.send({ type: "STOP_AUDIO" })}
                >
                  Stop Audio
                </button>`}

            <input
              type="text"
              class="${baseInputClasses} flex-grow"
              placeholder="Pattern Name (e.g., 'Verse 1')"
              .value=${context.patternName}
              @input=${(e: Event) =>
                appActor.send({
                  type: "UPDATE_PATTERN_NAME",
                  value: (e.target as HTMLInputElement).value,
                })}
            />

            <button
              class=${primaryButtonClasses}
              ?disabled=${!context.patternName.trim() || isSaving}
              @click=${() =>
                appActor.send({
                  type: "SAVE_PATTERN",
                  input: {
                    name: context.patternName,
                    content: context.currentPattern,
                  },
                })}
            >
              ${isSaving ? "Saving..." : "Save Pattern"}
            </button>
          </div>
        </div>

        <div class="mt-8 ${cardClasses}">
          <label for="load-select" class=${labelClasses}>Load a Pattern</label>
          <select
            id="load-select"
            class="${baseInputClasses} w-full"
            @change=${(e: Event) =>
              appActor.send({
                type: "SELECT_PATTERN",
                id: (e.target as HTMLSelectElement).value,
              })}
          >
            <option value="">Select a saved pattern...</option>
            ${context.savedChords.map(
              (chord: SerializableChord) => html`
                <option .value=${chord.id ?? ""}>
                  ${chord.name.split(": ")[0]}
                </option>
              `,
            )}
          </select>
        </div>

        ${context.errorMessage
          ? html`<div class=${errorClasses}>
              <strong>Error:</strong> ${context.errorMessage}
            </div>`
          : ""}
      </div>
    </div>
  `;
};

// --- AUDIO & RENDER LOGIC ---

function parseCode(code: string): string[] {
  return code.trim().split(/\s+/).filter(Boolean);
}

function updateSequence(notes: string[]) {
  sequence.events = notes;
}

appActor.subscribe((snapshot: AppSnapshot) => {
  render(appTemplate(snapshot), appContainer);

  if (snapshot.matches({ running: { audio: "on" } })) {
    if (transport.state !== "started") {
      startAudio().then(() => transport.start());
    }
  } else if (snapshot.matches({ running: { audio: "off" } })) {
    if (transport.state !== "stopped") {
      transport.stop();
    }
  }

  const currentPatternNotes = parseCode(snapshot.context.currentPattern);
  if (JSON.stringify(currentPatternNotes) !== JSON.stringify(sequence.events)) {
    updateSequence(currentPatternNotes);
  }
});

sequence = new Sequence(
  (time, note) => {
    synth.triggerAttackRelease(note, "8n", time);
  },
  parseCode(appActor.getSnapshot().context.currentPattern),
  "4n",
).start(0);
