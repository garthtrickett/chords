// src/client.ts
import "./index.css";
import { html, render } from "lit-html";
import { createActor, fromPromise, type SnapshotFrom } from "xstate";
import { getTransport, Synth, Part, start as startAudio } from "tone";
import { treaty } from "@elysiajs/eden";
import type { App } from "./server";
import { appMachine } from "./machine";
import type { SerializablePattern, NoteEvent } from "../types/database";

const appContainer = document.querySelector<HTMLElement>("#app");
if (!(appContainer instanceof HTMLElement)) {
  throw new Error("App container not found or is not a valid HTML element");
}

type AppSnapshot = SnapshotFrom<typeof appMachine>;

const client = treaty<App>("http://localhost:8080");
const synth = new Synth().toDestination();
const transport = getTransport();

// Use Tone.Part for polyphonic scheduling
let part = new Part<NoteEvent>().start(0);
part.loop = true;
part.loopEnd = "1m"; // Loop every 1 measure by default

// --- XSTATE ACTOR & SERVICES ---

const machineWithImplementations = appMachine.provide({
  actors: {
    // Provide the implementation for the 'fetchPatterns' actor
    fetchPatterns: fromPromise(async () => {
      const { data, error } = await client.patterns.get();
      if (error) throw new Error(JSON.stringify(error.value));
      return data || [];
    }),
    // Provide the implementation for the 'savePattern' actor
    savePattern: fromPromise(
      async ({ input }: { input: { name: string; content: string } }) => {
        const { name, content } = input;
        const { error } = await client.patterns.post({
          name: name,
          notes: content, // Send the raw JSON string to the server
        });
        if (error) throw new Error(JSON.stringify(error.value));
      },
    ),
  },
});

const appActor = createActor(machineWithImplementations).start();

// --- LIT-HTML TEMPLATE ---

const appTemplate = (state: AppSnapshot) => {
  const { context } = state;
  const isAudioOn = state.matches({ running: { audio: "on" } });
  const isSaving = state.matches({ running: { saveStatus: "saving" } });

  // --- Tailwind CSS Classes ---
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
            Polyphonic Live Coder
          </h1>
          <p class="text-zinc-400 mt-2">
            Create, play, and save polyphonic patterns in real-time.
          </p>
        </header>

        <div class=${cardClasses}>
          <textarea
            class="${baseInputClasses} min-h-[240px] font-mono text-base resize-y w-full"
            .value=${context.currentPattern}
            @input=${(e: Event) =>
              appActor.send({
                type: "UPDATE_PATTERN",
                value: (e.target as HTMLTextAreaElement).value,
              })}
            placeholder='[
  { "time": "0:0:0", "note": "C4", "duration": "8n" },
  { "time": "0:0:2", "note": "E4", "duration": "8n" },
  { "time": "0:1:0", "note": "G4", "duration": "8n" }
]'
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
            ${context.savedPatterns.map(
              (pattern: SerializablePattern) => html`
                <option .value=${pattern.id ?? ""}>${pattern.name}</option>
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

/**
 * Safely parses a JSON string into an array of NoteEvent objects.
 * Returns an empty array if the JSON is invalid.
 */
function parseCode(code: string): NoteEvent[] {
  try {
    const parsed = JSON.parse(code);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

/**
 * Clears and repopulates the Tone.Part with new note events.
 */
function updatePart(notes: NoteEvent[]) {
  part.clear();
  notes.forEach((noteEvent) => {
    part.add(noteEvent);
  });
}

// Keep track of the last pattern string that was successfully scheduled
let lastScheduledPattern = "";

appActor.subscribe((snapshot: AppSnapshot) => {
  // Render the UI based on the latest state
  render(appTemplate(snapshot), appContainer);

  // --- Audio Transport Control ---
  if (snapshot.matches({ running: { audio: "on" } })) {
    if (transport.state !== "started") {
      startAudio().then(() => transport.start());
    }
  } else if (snapshot.matches({ running: { audio: "off" } })) {
    if (transport.state !== "stopped") {
      transport.stop();
    }
  }

  // --- Audio Scheduling Update ---
  const currentPatternString = snapshot.context.currentPattern;

  // Only update the musical part if the text has actually changed.
  if (currentPatternString !== lastScheduledPattern) {
    const newNotes = parseCode(currentPatternString);
    updatePart(newNotes);
    lastScheduledPattern = currentPatternString;
  }
});

// Initialize the part with the default pattern from the machine's context
part = new Part<NoteEvent>((time, value) => {
  synth.triggerAttackRelease(value.note, value.duration, time);
}, parseCode(appActor.getSnapshot().context.currentPattern)).start(0);

part.loop = true;
part.loopEnd = "1m";
