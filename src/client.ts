// src/client.ts
import "./index.css";
import { html, render } from "lit-html";
import { createActor, fromPromise, type SnapshotFrom } from "xstate";
import { Effect, Data } from "effect";
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
import type {
  SerializablePattern,
  NoteEvent,
  SerializableChord,
} from "../types/app";

// --- DYNAMIC STYLES ---
const style = document.createElement("style");
style.textContent = `
  .highlight {
    background-color: rgba(20, 184, 166, 0.3);
    /* Corresponds to Tailwind's bg-teal-400/30 */
    border-color: rgb(20 184 166);
    /* Corresponds to Tailwind's border-teal-400 */
  }
`;
document.head.appendChild(style);

// --- EDEN, EFFECT & XSTATE SETUP ---

class ApiError extends Data.TaggedError("ApiError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

type AppSnapshot = SnapshotFrom<typeof appMachine>;
const client = treaty<App>("http://localhost:8080");
// --- Effect-based API Call Descriptions ---

const fetchInitialDataEffect = Effect.all([
  Effect.tryPromise({
    try: () => client.patterns.get(),
    catch: (cause) =>
      new ApiError({ message: "Failed to fetch patterns.", cause }),
  }),
  Effect.tryPromise({
    try: () => client.chords.get(),
    catch: (cause) =>
      new ApiError({ message: "Failed to fetch chords.", cause }),
  }),
]).pipe(
  Effect.flatMap(([patternsResponse, chordsResponse]) => {
    if (patternsResponse.error)
      return Effect.fail(
        new ApiError({
          message: "API error fetching patterns",
          cause: patternsResponse.error.value,
        }),
      );
    if (chordsResponse.error)
      return Effect.fail(
        new ApiError({
          message: "API error fetching chords",
          cause: chordsResponse.error.value,
        }),
      );
    return Effect.succeed({
      patterns: patternsResponse.data ?? [],
      chords: chordsResponse.data ?? [],
    });
  }),
);

const createPatternEffect = (input: { name: string; notes: string }) =>
  Effect.tryPromise({
    try: () => client.patterns.post(input),
    catch: (cause) =>
      new ApiError({
        message: "Network request failed while creating pattern.",
        cause,
      }),
  }).pipe(
    Effect.flatMap(({ data, error }) => {
      if (error) {
        const message =
          (error.value as any)?.error ?? "An unknown API error occurred.";
        return Effect.fail(new ApiError({ message, cause: error.value }));
      }
      if (!data) {
        return Effect.fail(
          new ApiError({ message: "API did not return the created pattern." }),
        );
      }
      return Effect.succeed(data as SerializablePattern);
    }),
  );

const updatePatternEffect = (input: {
  id: string;
  name: string;
  content: string;
}) => {
  const { id, name, content } = input;
  return Effect.tryPromise({
    try: () => client.patterns({ id }).put({ name, notes: content }),
    catch: (cause) =>
      new ApiError({
        message: "Network request failed while updating pattern.",
        cause,
      }),
  }).pipe(
    Effect.flatMap(({ error }) => {
      if (error) {
        const message =
          (error.value as any)?.error ?? "An unknown API error occurred.";
        return Effect.fail(new ApiError({ message, cause: error.value }));
      }
      return Effect.succeed(undefined as void);
    }),
  );
};

const createChordEffect = (input: { name: string; tab: string }) =>
  Effect.tryPromise({
    try: () => client.chords.post(input),
    catch: (cause) =>
      new ApiError({
        message: "Network request failed while creating chord.",
        cause,
      }),
  }).pipe(
    Effect.flatMap(({ data, error }) => {
      if (error) {
        const message =
          (error.value as any)?.error ?? "An unknown API error occurred.";
        return Effect.fail(new ApiError({ message, cause: error.value }));
      }
      if (!data)
        return Effect.fail(
          new ApiError({ message: "API did not return the created chord." }),
        );
      return Effect.succeed(data as SerializableChord);
    }),
  );

const machineWithImplementations = appMachine.provide({
  actors: {
    fetchInitialData: fromPromise(() =>
      Effect.runPromise(fetchInitialDataEffect),
    ),
    createPattern: fromPromise(({ input }) =>
      Effect.runPromise(createPatternEffect(input)),
    ),
    updatePattern: fromPromise(({ input }) =>
      Effect.runPromise(updatePatternEffect(input)),
    ),
    createChord: fromPromise(({ input }) =>
      Effect.runPromise(createChordEffect(input)),
    ),
  },
});
const appActor = createActor(machineWithImplementations).start();

// --- TONE.JS SETUP ---
const synth = new PolySynth(Synth).toDestination();
const transport = getTransport();
let part = new Part<NoteEvent & { index: number }>().start(0); // MODIFIED: Part now expects an index
part.loop = true;
part.loopEnd = "64m";

// --- XSTATE SELECTORS ---
const selectIsAudioOn = (s: AppSnapshot) =>
  s.matches({ running: { editing: { audio: "on" } } });
const selectIsSaving = (s: AppSnapshot) =>
  !s.matches({ running: { editing: { saveStatus: "idle" } } });
const selectCurrentPattern = (s: AppSnapshot) => s.context.currentPattern;
const selectPatternName = (s: AppSnapshot) => s.context.patternName;
const selectSavedPatterns = (s: AppSnapshot) => s.context.savedPatterns;
const selectSavedChords = (s: AppSnapshot) => s.context.savedChords;
const selectErrorMessage = (s: AppSnapshot) => s.context.errorMessage;
const selectSelectedPatternId = (s: AppSnapshot) => s.context.selectedPatternId;
const selectIsShowDialog = (s: AppSnapshot) =>
  s.matches({ running: "showingNewPatternDialog" });
const selectNewPatternName = (s: AppSnapshot) => s.context.newPatternName;
const selectViewMode = (s: AppSnapshot) =>
  s.matches({ running: { editing: { viewMode: "visual" } } })
    ? "visual"
    : "json";

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
const VisualEditor = (currentPattern: string) => {
  let notes: NoteEvent[] = [];
  try {
    const parsed = JSON.parse(currentPattern);
    if (Array.isArray(parsed)) {
      notes = parsed;
    }
  } catch (e) {
    return html`<div
      class="min-h-[240px] p-4 text-red-400 border border-red-500/50 rounded-md"
    >
      Invalid JSON format. Switch to JSON view to fix.
    </div>`;
  }

  return html`
    <div
      class="space-y-2 p-4 border border-zinc-700 rounded-lg bg-zinc-950/50 min-h-[240px]"
    >
      ${notes.map(
        (note, index) => html`
          <div
            id="note-${index}"
            class="flex items-center gap-4 p-2 bg-zinc-800 rounded transition-colors duration-75"
          >
            <span class="font-mono text-cyan-400 w-20">Time: ${note.time}</span>
            <span class="font-mono text-pink-400 w-20">Note: ${note.note}</span>
            <span class="font-mono text-amber-400 w-24"
              >Dur: ${note.duration}</span
            >
          </div>
        `,
      )}
    </div>
  `;
};

const Controls = (props: {
  isAudioOn: boolean;
  isSaving: boolean;
  patternName: string;
  selectedPatternId: string | null;
  viewMode: "json" | "visual";
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
      class=${secondaryButtonClasses}
      @click=${() => appActor.send({ type: "TOGGLE_VIEW" })}
    >
      ${props.viewMode === "json" ? "Visual View" : "JSON View"}
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

const ChordBank = (savedChords: SerializableChord[]) => html`
  <h3 class="text-lg font-medium mb-4 text-zinc-50">Chord Bank</h3>
  <form
    @submit=${(e: Event) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const name = formData.get("chord-name") as string;
      const tab = formData.get("chord-tab") as string;
      if (name.trim() && tab.trim()) {
        appActor.send({ type: "CREATE_CHORD", input: { name, tab } });
        (e.target as HTMLFormElement).reset();
      }
    }}
    class="flex items-end gap-4 mb-6"
  >
    <div class="flex-grow">
      <label for="chord-name" class=${labelClasses}>Chord Name</label>
      <input
        id="chord-name"
        name="chord-name"
        type="text"
        class=${baseInputClasses}
        placeholder="e.g., G Major"
        required
      />
    </div>
    <div class="flex-grow">
      <label for="chord-tab" class=${labelClasses}>Tablature</label>
      <input
        id="chord-tab"
        name="chord-tab"
        type="text"
        class="${baseInputClasses} font-mono"
        placeholder="e.g., 320003"
        required
      />
    </div>
    <button type="submit" class=${primaryButtonClasses}>Add Chord</button>
  </form>

  <div class="space-y-2">
    ${savedChords.map(
      (chord) => html`
        <div class="flex items-center gap-4 p-2 bg-zinc-800 rounded">
          <span class="font-semibold text-zinc-300 w-32">${chord.name}</span>
          <span class="font-mono text-cyan-400">${chord.tab}</span>
        </div>
      `,
    )}
    ${savedChords.length === 0
      ? html`<p class="text-zinc-500">No chords saved yet.</p>`
      : ""}
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
      <div class="mt-8 ${cardClasses}">
        <div id="chord-bank-container"></div>
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

render(AppShell(), appShellContainer);

const editorContainer =
  document.querySelector<HTMLElement>("#editor-container");
const controlsContainer = document.querySelector<HTMLElement>(
  "#controls-container",
);
const loaderContainer =
  document.querySelector<HTMLElement>("#loader-container");
const modalContainer = document.querySelector<HTMLElement>("#modal-container");
const chordBankContainer = document.querySelector<HTMLElement>(
  "#chord-bank-container",
);
if (
  !editorContainer ||
  !controlsContainer ||
  !loaderContainer ||
  !modalContainer ||
  !chordBankContainer
)
  throw new Error("Could not find component containers");
appActor.subscribe((snapshot) => {
  const viewMode = selectViewMode(snapshot);

  render(
    viewMode === "json"
      ? PatternEditor(selectCurrentPattern(snapshot))
      : VisualEditor(selectCurrentPattern(snapshot)),
    editorContainer,
  );

  render(
    Controls({
      isAudioOn: selectIsAudioOn(snapshot),
      isSaving: selectIsSaving(snapshot),
      patternName: selectPatternName(snapshot),
      selectedPatternId: selectSelectedPatternId(snapshot),
      viewMode: viewMode,
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
  render(ChordBank(selectSavedChords(snapshot)), chordBankContainer);
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
  const indexedNotes = notes.map((note, index) => ({ ...note, index }));
  indexedNotes.forEach((noteEvent) => {
    part.add(noteEvent);
  });
}

let lastScheduledPattern = "";
appActor.subscribe((snapshot) => {
  if (selectIsAudioOn(snapshot)) {
    if (transport.state !== "started")
      startAudio().then(() => transport.start());
  } else {
    if (transport.state !== "stopped") transport.stop();
  }
  const currentPatternString = selectCurrentPattern(snapshot);
  if (currentPatternString !== lastScheduledPattern) {
    const newNotes = parseCode(currentPatternString);
    updatePart(newNotes);
    lastScheduledPattern = currentPatternString;
  }
});
part = new Part<NoteEvent & { index: number }>((time, value) => {
  synth.triggerAttackRelease(value.note, value.duration, time);

  const el = document.getElementById(`note-${value.index}`);
  if (el) {
    el.classList.add("highlight");
    setTimeout(() => {
      el.classList.remove("highlight");
    }, 150);
  }
}, []).start(0);
updatePart(parseCode(appActor.getSnapshot().context.currentPattern));
