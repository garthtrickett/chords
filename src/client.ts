// src/client.ts
import "./index.css";
import { html, render } from "lit-html";
import { createActor, fromPromise, type SnapshotFrom } from "xstate";
import {
  getTransport,
  Synth,
  PolySynth,
  Part,
  start as startAudio,
} from "tone";
import { treaty } from "@elysiajs/eden";
import type { App } from "./server";
import { appMachine } from "./machine";
import type { SerializablePattern, NoteEvent } from "../types/app";

// --- EDEN & XSTATE SETUP ---

type AppSnapshot = SnapshotFrom<typeof appMachine>;
const client = treaty<App>("http://localhost:8080");

const machineWithImplementations = appMachine.provide({
  actors: {
    fetchPatterns: fromPromise(async () => {
      const { data, error } = await client.patterns.get();
      if (error) throw new Error(JSON.stringify(error.value));
      return data || [];
    }),
    // NEW: Actor for creating a new pattern
    createPattern: fromPromise(
      async ({ input }: { input: { name: string; notes: string } }) => {
        const { data, error } = await client.patterns.post(input);
        if (error) throw new Error(JSON.stringify(error.value));
        if (!data) throw new Error("API did not return created pattern.");
        return data as SerializablePattern;
      },
    ),
    // NEW: Actor for updating an existing pattern
    updatePattern: fromPromise(
      async ({
        input,
      }: {
        input: { id: string; name: string; content: string };
      }) => {
        const { id, name, content } = input;
        const { error } = await client.patterns({ id: id }).put({
          name,
          notes: content,
        });
        if (error) throw new Error(JSON.stringify(error.value));
      },
    ),
  },
});

const appActor = createActor(machineWithImplementations).start();

// --- TONE.JS SETUP ---
const synth = new PolySynth(Synth).toDestination();
const transport = getTransport();
let part = new Part<NoteEvent>().start(0);
part.loop = true;
part.loopEnd = "64m";

// --- XSTATE SELECTORS ---
const selectIsAudioOn = (s: AppSnapshot) =>
  s.matches({ running: { editing: { audio: "on" } } }); // Path updated
const selectIsSaving = (s: AppSnapshot) =>
  !s.matches({ running: { editing: { saveStatus: "idle" } } }); // Logic updated
const selectCurrentPattern = (s: AppSnapshot) => s.context.currentPattern;
const selectPatternName = (s: AppSnapshot) => s.context.patternName;
const selectSavedPatterns = (s: AppSnapshot) => s.context.savedPatterns;
const selectErrorMessage = (s: AppSnapshot) => s.context.errorMessage;
const selectSelectedPatternId = (s: AppSnapshot) => s.context.selectedPatternId; // New selector
const selectIsShowDialog = (s: AppSnapshot) =>
  s.matches({ running: "showingNewPatternDialog" }); // New selector
const selectNewPatternName = (s: AppSnapshot) => s.context.newPatternName; // New selector

// --- TAILWIND CSS CLASSES (Shared) ---
const cardClasses =
  "bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-md";
const baseInputClasses =
  "flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm ring-offset-zinc-950 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClasses =
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-zinc-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-zinc-50 text-zinc-900 hover:bg-zinc-50/90 h-10 px-4 py-2";
const secondaryButtonClasses =
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-zinc-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-zinc-800 text-zinc-50 hover:bg-zinc-800/80 h-10 px-4 py-2";
const destructiveButtonClasses =
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-zinc-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-zinc-50 hover:bg-red-600/90 h-10 px-4 py-2";
const labelClasses =
  "text-sm font-medium leading-none text-zinc-400 mb-2 block";

// --- LIT-HTML TEMPLATES ---
const PatternEditor = (currentPattern: string) => html`
  <textarea
    class="${baseInputClasses} min-h-[240px] font-mono text-base resize-y w-full"
    .value=${currentPattern}
    @input=${(e: Event) =>
      appActor.send({
        type: "UPDATE_PATTERN",
        value: (e.target as HTMLTextAreaElement).value,
      })}
    placeholder='[
  { "time": "0:0", "note": "C4", "duration": "8n" },
  { "time": "0:0", "note": "E4", "duration": "8n" }
]'
  ></textarea>
`;

const Controls = (props: {
  isAudioOn: boolean;
  isSaving: boolean;
  patternName: string;
  selectedPatternId: string | null;
}) => html`
  <div
    class="mt-6 flex flex-col sm:flex-row flex-wrap gap-4 items-center justify-center"
  >
    ${!props.isAudioOn
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
      placeholder="Pattern Name"
      .value=${props.patternName}
      @input=${(e: Event) =>
        appActor.send({
          type: "UPDATE_PATTERN_NAME",
          value: (e.target as HTMLInputElement).value,
        })}
    />

    <button
      class=${secondaryButtonClasses}
      @click=${() => appActor.send({ type: "NEW_PATTERN" })}
    >
      New Pattern
    </button>

    <button
      class=${primaryButtonClasses}
      ?disabled=${!props.patternName.trim() ||
      props.isSaving ||
      !props.selectedPatternId}
      @click=${() => {
        const latest = appActor.getSnapshot();
        if (latest.context.selectedPatternId) {
          appActor.send({
            type: "UPDATE_SAVED_PATTERN",
            input: {
              id: latest.context.selectedPatternId,
              name: latest.context.patternName,
              content: latest.context.currentPattern,
            },
          });
        }
      }}
    >
      ${props.isSaving ? "Saving..." : "Save Pattern"}
    </button>
  </div>
`;

const PatternLoader = (
  savedPatterns: SerializablePattern[],
  selectedId: string | null,
) => html`
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
    <option value="" ?selected=${!selectedId}>Select a saved pattern...</option>
    ${savedPatterns.map(
      (p) =>
        html`<option .value=${p.id ?? ""} ?selected=${p.id === selectedId}>
          ${p.name}
        </option>`,
    )}
  </select>
`;

const ErrorMessage = (errorMessage: string | null) => {
  if (!errorMessage) return html``;
  return html`
    <div class="container mx-auto p-4 md:p-8 max-w-3xl">
      <div
        class="mt-4 p-4 bg-red-900/20 text-red-400 border border-red-500/50 rounded-md text-sm"
      >
        <strong>Error:</strong> ${errorMessage}
      </div>
    </div>
  `;
};

// NEW: A modal dialog for creating a new pattern
const NewPatternDialog = (newPatternName: string) => html`
  <div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
    @click=${(e: Event) => {
      if (e.currentTarget === e.target)
        appActor.send({ type: "CANCEL_NEW_PATTERN" });
    }}
  >
    <div class="${cardClasses} w-full max-w-sm">
      <h3 class="text-lg font-medium mb-4 text-zinc-50">Create New Pattern</h3>
      <label for="new-pattern-name" class="${labelClasses}">Pattern Name</label>
      <input
        id="new-pattern-name"
        type="text"
        class="${baseInputClasses}"
        placeholder="e.g., 'Ambient Arp'"
        .value=${newPatternName}
        @input=${(e: Event) =>
          appActor.send({
            type: "UPDATE_NEW_PATTERN_NAME",
            value: (e.target as HTMLInputElement).value,
          })}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter")
            appActor.send({ type: "CREATE_PATTERN", name: newPatternName });
        }}
      />
      <div class="mt-6 flex justify-end gap-3">
        <button
          class=${secondaryButtonClasses}
          @click=${() => appActor.send({ type: "CANCEL_NEW_PATTERN" })}
        >
          Cancel
        </button>
        <button
          class=${primaryButtonClasses}
          ?disabled=${!newPatternName.trim()}
          @click=${() =>
            appActor.send({ type: "CREATE_PATTERN", name: newPatternName })}
        >
          Create
        </button>
      </div>
    </div>
  </div>
`;

const AppShell = () => html`
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
        <div id="editor-container"></div>
        <div id="controls-container"></div>
      </div>
      <div class="mt-8 ${cardClasses}">
        <div id="loader-container"></div>
      </div>
    </div>
    <div id="modal-container"></div>
  </div>
`;

// --- RENDER & SUBSCRIPTION ---
const appShellContainer = document.querySelector<HTMLElement>("#app-shell");
const errorContainer = document.querySelector<HTMLElement>("#error-container");
if (!appShellContainer || !errorContainer)
  throw new Error("Could not find root containers");

// Render the static parts of the UI once
render(AppShell(), appShellContainer);

// Get containers for the dynamic parts
const editorContainer =
  document.querySelector<HTMLElement>("#editor-container");
const controlsContainer = document.querySelector<HTMLElement>(
  "#controls-container",
);
const loaderContainer =
  document.querySelector<HTMLElement>("#loader-container");
const modalContainer = document.querySelector<HTMLElement>("#modal-container");
if (
  !editorContainer ||
  !controlsContainer ||
  !loaderContainer ||
  !modalContainer
)
  throw new Error("Could not find component containers");

// REFACTORED: Use a single, efficient subscription to render all dynamic UI
appActor.subscribe((snapshot) => {
  render(PatternEditor(selectCurrentPattern(snapshot)), editorContainer);
  render(
    Controls({
      isAudioOn: selectIsAudioOn(snapshot),
      isSaving: selectIsSaving(snapshot),
      patternName: selectPatternName(snapshot),
      selectedPatternId: selectSelectedPatternId(snapshot),
    }),
    controlsContainer,
  );
  render(
    PatternLoader(
      selectSavedPatterns(snapshot),
      selectSelectedPatternId(snapshot),
    ),
    loaderContainer,
  );
  render(ErrorMessage(selectErrorMessage(snapshot)), errorContainer);
  render(
    selectIsShowDialog(snapshot)
      ? NewPatternDialog(selectNewPatternName(snapshot))
      : html``,
    modalContainer,
  );
});

// --- AUDIO SIDE-EFFECTS ---
function parseCode(code: string): NoteEvent[] {
  try {
    const parsed = JSON.parse(code);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function updatePart(notes: NoteEvent[]) {
  part.clear();
  notes.forEach((noteEvent) => {
    part.add(noteEvent);
  });
}

let lastScheduledPattern = "";
appActor.subscribe((snapshot) => {
  // Handle audio transport start/stop
  if (selectIsAudioOn(snapshot)) {
    if (transport.state !== "started")
      startAudio().then(() => transport.start());
  } else {
    if (transport.state !== "stopped") transport.stop();
  }
  // Update the musical part if the pattern text has changed
  const currentPatternString = selectCurrentPattern(snapshot);
  if (currentPatternString !== lastScheduledPattern) {
    const newNotes = parseCode(currentPatternString);
    updatePart(newNotes);
    lastScheduledPattern = currentPatternString;
  }
});

part = new Part<NoteEvent>((time, value) => {
  synth.triggerAttackRelease(value.note, value.duration, time);
}, parseCode(appActor.getSnapshot().context.currentPattern)).start(0);
