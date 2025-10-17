// src/client.ts
import "./index.css";
import { html, render, nothing } from "lit-html";
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
import type { SerializablePattern, NoteEvent, SerializableChord, SerializableTuning } from "../types/app";

// --- DYNAMIC STYLES ---
const style = document.createElement("style");
style.textContent = `
  .highlight {
    background-color: rgba(20, 184, 166, 0.3); /* Corresponds to Tailwind's bg-teal-400/30 */
    border-color: rgb(20 184 166); /* Corresponds to Tailwind's border-teal-400 */
  }
`;
document.head.appendChild(style);

// --- UTILITIES ---
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_MAP: Record<string, number> = { "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11 };

function calculateNotesFromTab(tab: string, tuningNotes: string[]): string[] {
  const notes: string[] = [];
  for (let i = 0; i < 6; i++) {
    const fret = tab[i];
    if (fret === "x" || fret === "X" || fret === undefined) {
      notes.push("x");
      continue;
    }
    const fretNum = parseInt(fret, 10);
    if (isNaN(fretNum)) {
      notes.push("?");
      continue;
    }
    const openStringNote = tuningNotes[i]?.toUpperCase();
    if (!openStringNote || NOTE_MAP[openStringNote] === undefined) {
      notes.push("?");
      continue;
    }
    const openNoteIndex = NOTE_MAP[openStringNote];
    const finalNoteIndex = (openNoteIndex + fretNum) % 12;
    notes.push(NOTES[finalNoteIndex]);
  }
  return notes;
}

// --- EDEN, EFFECT & XSTATE SETUP ---
class ApiError extends Data.TaggedError("ApiError")<{ readonly message: string; readonly cause?: unknown; }> { }
type AppSnapshot = SnapshotFrom<typeof appMachine>;
const client = treaty<App>("http://localhost:8080");

// --- Effect-based API Call Descriptions ---
const fetchInitialDataEffect = Effect.all([
  Effect.tryPromise({ try: () => client.patterns.get(), catch: (cause) => new ApiError({ message: "Failed to fetch patterns.", cause }) }),
  Effect.tryPromise({ try: () => client.chords.get(), catch: (cause) => new ApiError({ message: "Failed to fetch chords.", cause }) }),
  Effect.tryPromise({ try: () => client.tunings.get(), catch: (cause) => new ApiError({ message: "Failed to fetch tunings.", cause }) }),
]).pipe(
  Effect.flatMap(([patternsResponse, chordsResponse, tuningsResponse]) => {
    if (patternsResponse.error) return Effect.fail(new ApiError({ message: "API error fetching patterns", cause: patternsResponse.error.value }));
    if (chordsResponse.error) return Effect.fail(new ApiError({ message: "API error fetching chords", cause: chordsResponse.error.value }));
    if (tuningsResponse.error) return Effect.fail(new ApiError({ message: "API error fetching tunings", cause: tuningsResponse.error.value }));
    return Effect.succeed({ patterns: patternsResponse.data ?? [], chords: chordsResponse.data ?? [], tunings: tuningsResponse.data ?? [] });
  })
);

const createPatternEffect = (input: { name: string; notes: string }) => Effect.tryPromise({ try: () => client.patterns.post(input), catch: (cause) => new ApiError({ message: "Network request failed while creating pattern.", cause }) }).pipe(Effect.flatMap(({ data, error }) => { if (error) { const message = (error.value as any)?.error ?? "An unknown API error occurred."; return Effect.fail(new ApiError({ message, cause: error.value })); } if (!data) { return Effect.fail(new ApiError({ message: "API did not return the created pattern." })); } return Effect.succeed(data as SerializablePattern); }));
const updatePatternEffect = (input: { id: string; name: string; content: string }) => { const { id, name, content } = input; return Effect.tryPromise({ try: () => client.patterns({ id }).put({ name, notes: content }), catch: (cause) => new ApiError({ message: "Network request failed while updating pattern.", cause }) }).pipe(Effect.flatMap(({ error }) => { if (error) { const message = (error.value as any)?.error ?? "An unknown API error occurred."; return Effect.fail(new ApiError({ message, cause: error.value })); } return Effect.succeed(undefined as void); })); };
const createChordEffect = (input: { name: string; tab: string; tuning: string }) => Effect.tryPromise({ try: () => client.chords.post(input), catch: (cause) => new ApiError({ message: "Network request failed while creating chord.", cause }) }).pipe(Effect.flatMap(({ data, error }) => { if (error) { const message = (error.value as any)?.error ?? "An unknown API error occurred."; return Effect.fail(new ApiError({ message, cause: error.value })); } if (!data) return Effect.fail(new ApiError({ message: "API did not return the created chord." })); return Effect.succeed(data as SerializableChord); }));
const createTuningEffect = (input: { name: string; notes: string }) => Effect.tryPromise({ try: () => client.tunings.post(input), catch: (cause) => new ApiError({ message: "Network request failed while creating tuning.", cause }) }).pipe(Effect.flatMap(({ data, error }) => { if (error) return Effect.fail(new ApiError({ message: (error.value as any)?.error ?? "API error", cause: error.value })); if (!data) return Effect.fail(new ApiError({ message: "API did not return created tuning." })); return Effect.succeed(data as SerializableTuning); }));
const updateTuningEffect = (input: { id: string; name: string; notes: string }) => Effect.tryPromise({ try: () => client.tunings({ id: input.id }).put(input), catch: (cause) => new ApiError({ message: "Network request failed while updating tuning.", cause }) }).pipe(Effect.flatMap(({ error }) => { if (error) return Effect.fail(new ApiError({ message: (error.value as any)?.error ?? "API error", cause: error.value })); return Effect.succeed(undefined as void); }));
const deleteTuningEffect = (input: { id: string }) => Effect.tryPromise({ try: () => client.tunings({ id: input.id }).delete(), catch: (cause) => new ApiError({ message: "Network request failed while deleting tuning.", cause }) }).pipe(Effect.flatMap(({ error }) => { if (error) return Effect.fail(new ApiError({ message: (error.value as any)?.error ?? "API error", cause: error.value })); return Effect.succeed(undefined as void); }));
// NEW: Add effects for updating and deleting chords
const updateChordEffect = (input: { id: string; name: string; tab: string; tuning: string }) => Effect.tryPromise({ try: () => client.chords({ id: input.id }).put(input), catch: (cause) => new ApiError({ message: "Network request failed while updating chord.", cause }) }).pipe(Effect.flatMap(({ error }) => { if (error) return Effect.fail(new ApiError({ message: (error.value as any)?.error ?? "API error", cause: error.value })); return Effect.succeed(undefined as void); }));
const deleteChordEffect = (input: { id: string }) => Effect.tryPromise({ try: () => client.chords({ id: input.id }).delete(), catch: (cause) => new ApiError({ message: "Network request failed while deleting chord.", cause }) }).pipe(Effect.flatMap(({ error }) => { if (error) return Effect.fail(new ApiError({ message: (error.value as any)?.error ?? "API error", cause: error.value })); return Effect.succeed(undefined as void); }));

const machineWithImplementations = appMachine.provide({
  actors: {
    fetchInitialData: fromPromise(() => Effect.runPromise(fetchInitialDataEffect)),
    createPattern: fromPromise(({ input }) => Effect.runPromise(createPatternEffect(input))),
    updatePattern: fromPromise(({ input }) => Effect.runPromise(updatePatternEffect(input))),
    createChord: fromPromise(({ input }) => Effect.runPromise(createChordEffect(input))),
    // NEW: Provide the implementations for the new actors
    updateChord: fromPromise(({ input }) => Effect.runPromise(updateChordEffect(input))),
    deleteChord: fromPromise(({ input }) => Effect.runPromise(deleteChordEffect(input))),
    createTuning: fromPromise(({ input }) => Effect.runPromise(createTuningEffect(input))),
    updateTuning: fromPromise(({ input }) => Effect.runPromise(updateTuningEffect(input))),
    deleteTuning: fromPromise(({ input }) => Effect.runPromise(deleteTuningEffect(input))),
  },
});
const appActor = createActor(machineWithImplementations).start();

// --- TONE.JS SETUP ---
const synth = new PolySynth(Synth).toDestination();
const transport = getTransport();
let part = new Part<NoteEvent & { index: number }>().start(0);
part.loop = true;
part.loopEnd = "64m";

// --- XSTATE SELECTORS ---
const selectIsAudioOn = (s: AppSnapshot) => s.matches({ running: { editing: { audio: "on" } } });
const selectIsSaving = (s: AppSnapshot) => !s.matches({ running: { editing: { saveStatus: "idle" } } });
const selectCurrentPattern = (s: AppSnapshot) => s.context.currentPattern;
const selectPatternName = (s: AppSnapshot) => s.context.patternName;
const selectSavedPatterns = (s: AppSnapshot) => s.context.savedPatterns;
const selectSavedChords = (s: AppSnapshot) => s.context.savedChords;
const selectSavedTunings = (s: AppSnapshot) => s.context.savedTunings;
const selectEditingChordId = (s: AppSnapshot) => s.context.editingChordId; // NEW: Selector for the editing chord
const selectErrorMessage = (s: AppSnapshot) => s.context.errorMessage;
const selectSelectedPatternId = (s: AppSnapshot) => s.context.selectedPatternId;
const selectIsShowDialog = (s: AppSnapshot) => s.matches({ running: "showingNewPatternDialog" });
const selectNewPatternName = (s: AppSnapshot) => s.context.newPatternName;
const selectViewMode = (s: AppSnapshot) => s.matches({ running: { editing: { viewMode: "visual" } } }) ? "visual" : "json";

// --- TAILWIND CSS CLASSES (Shared) ---
const cardClasses = "bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-md";
const baseInputClasses = "flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm ring-offset-zinc-950 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-zinc-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-zinc-50 text-zinc-900 hover:bg-zinc-50/90 h-10 px-4 py-2";
const secondaryButtonClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-zinc-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-zinc-800 text-zinc-50 hover:bg-zinc-800/80 h-10 px-4 py-2";
const destructiveButtonClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-zinc-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-zinc-50 hover:bg-red-600/90 h-10 px-4 py-2";
const labelClasses = "text-sm font-medium leading-none text-zinc-400 mb-2 block";

// --- LIT-HTML TEMPLATES ---
const PatternEditor = (currentPattern: string) => html`
  <textarea
    class="${baseInputClasses} min-h-[240px] font-mono text-base resize-y w-full"
    .value=${currentPattern}
    @input=${(e: Event) => appActor.send({ type: "UPDATE_PATTERN", value: (e.target as HTMLTextAreaElement).value })}
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
    return html`
      <div class="min-h-[240px] p-4 text-red-400 border border-red-500/50 rounded-md">
        Invalid JSON format. Switch to JSON view to fix.
      </div>
    `;
  }
  return html`
    <div class="space-y-2 p-4 border border-zinc-700 rounded-lg bg-zinc-950/50 min-h-[240px]">
      ${notes.map(
    (note, index) => html`
          <div id="note-${index}" class="flex items-center gap-4 p-2 bg-zinc-800 rounded transition-colors duration-75">
            <span class="font-mono text-cyan-400 w-20">Time: ${note.time}</span>
            <span class="font-mono text-pink-400 w-20">Note: ${note.note}</span>
            <span class="font-mono text-amber-400 w-24">Dur: ${note.duration}</span>
          </div>
        `
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
  <div class="mt-6 flex flex-col sm:flex-row flex-wrap gap-4 items-center justify-center">
    ${!props.isAudioOn
    ? html`<button class=${primaryButtonClasses} @click=${() => appActor.send({ type: "START_AUDIO" })}>Start Audio</button>`
    : html`<button class=${destructiveButtonClasses} @click=${() => appActor.send({ type: "STOP_AUDIO" })}>Stop Audio</button>`}

    <input
      type="text"
      class="${baseInputClasses} flex-grow"
      placeholder="Pattern Name"
      .value=${props.patternName}
      @input=${(e: Event) => appActor.send({ type: "UPDATE_PATTERN_NAME", value: (e.target as HTMLInputElement).value })}
    />

    <button class=${secondaryButtonClasses} @click=${() => appActor.send({ type: "NEW_PATTERN" })}>New Pattern</button>
    
    <button class=${secondaryButtonClasses} @click=${() => appActor.send({ type: "TOGGLE_VIEW" })}>
      ${props.viewMode === "json" ? "Visual View" : "JSON View"}
    </button>
    
    <button
      class=${primaryButtonClasses}
      ?disabled=${!props.patternName.trim() || props.isSaving || !props.selectedPatternId}
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

const PatternLoader = (savedPatterns: SerializablePattern[], selectedId: string | null) => html`
  <label for="load-select" class=${labelClasses}>Load a Pattern</label>
  <select
    id="load-select"
    class="${baseInputClasses} w-full"
    @change=${(e: Event) => appActor.send({ type: "SELECT_PATTERN", id: (e.target as HTMLSelectElement).value })}
  >
    <option value="" ?selected=${!selectedId}>Select a saved pattern...</option>
    ${savedPatterns.map(
  (p) => html`
        <option .value=${p.id ?? ""} ?selected=${p.id === selectedId}>
          ${p.name}
        </option>
      `
)}
  </select>
`;

const ErrorMessage = (errorMessage: string | null) => {
  if (!errorMessage) {
    return html``;
  }
  return html`
    <div class="container mx-auto p-4 md:p-8 max-w-3xl">
      <div class="mt-4 p-4 bg-red-900/20 text-red-400 border border-red-500/50 rounded-md text-sm">
        <strong>Error:</strong> ${errorMessage}
      </div>
    </div>
  `;
};

const NewPatternDialog = (newPatternName: string) => html`
  <div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
    @click=${(e: Event) => {
    if (e.currentTarget === e.target) appActor.send({ type: "CANCEL_NEW_PATTERN" });
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
        @input=${(e: Event) => appActor.send({ type: "UPDATE_NEW_PATTERN_NAME", value: (e.target as HTMLInputElement).value })}
        @keydown=${(e: KeyboardEvent) => {
    if (e.key === "Enter") appActor.send({ type: "CREATE_PATTERN", name: newPatternName });
  }}
      />
      <div class="mt-6 flex justify-end gap-3">
        <button class=${secondaryButtonClasses} @click=${() => appActor.send({ type: "CANCEL_NEW_PATTERN" })}>
          Cancel
        </button>
        <button
          class=${primaryButtonClasses}
          ?disabled=${!newPatternName.trim()}
          @click=${() => appActor.send({ type: "CREATE_PATTERN", name: newPatternName })}
        >
          Create
        </button>
      </div>
    </div>
  </div>
`;

// NEW: A template for the chord editor form
const ChordEditorForm = (chord: SerializableChord, savedTunings: SerializableTuning[]) => html`
  <form @submit=${(e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const name = formData.get("chord-name") as string;
    const tuning = formData.get("chord-tuning") as string;
    const tabInputs = Array.from(form.querySelectorAll<HTMLInputElement>('input[name^="fret-"]'));
    const tab = tabInputs.map(input => (input.value.trim() === "" ? "x" : input.value.trim())).join("");
    if (name.trim() && tab.length === 6 && chord.id) {
      appActor.send({ type: "UPDATE_CHORD", input: { id: chord.id, name, tab, tuning } });
    }
  }} class="p-3 bg-zinc-700 rounded my-3 space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="md:col-span-1">
        <label for="chord-name-${chord.id}" class=${labelClasses}>Chord Name</label>
        <input id="chord-name-${chord.id}" name="chord-name" type="text" class=${baseInputClasses} .value=${chord.name} required />
      </div>
      <div class="md:col-span-2">
        <label for="chord-tuning-${chord.id}" class=${labelClasses}>Tuning</label>
        <select id="chord-tuning-${chord.id}" name="chord-tuning" class="${baseInputClasses}">
          ${savedTunings.map(tuning => html`<option .value=${tuning.name} ?selected=${tuning.name === chord.tuning}>${tuning.name} (${tuning.notes})</option>`)}
        </select>
      </div>
    </div>
    <div>
      <label class=${labelClasses}>Tablature (e B G D A E)</label>
      <div class="grid grid-cols-6 gap-2">
        ${chord.tab.split('').map((fret, i) => html`<input type="text" name="fret-${i}" class="${baseInputClasses} font-mono text-center" maxlength="2" placeholder="x" .value=${fret.toLowerCase() === 'x' ? '' : fret} />`)}
      </div>
    </div>
    <div class="flex justify-end gap-2">
      <button type="button" @click=${() => appActor.send({ type: "CANCEL_EDIT_CHORD" })} class=${secondaryButtonClasses}>Cancel</button>
      <button type="submit" class=${primaryButtonClasses}>Save Changes</button>
    </div>
  </form>
`;


const ChordBank = (savedChords: SerializableChord[], savedTunings: SerializableTuning[], editingChordId: string | null) => {
  const tuningsMap = new Map(savedTunings.map(t => [t.name, t.notes.split(" ")]));
  return html`
    <h3 class="text-lg font-medium mb-4 text-zinc-50">Chord Bank</h3>
    <form @submit=${(e: Event) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const name = formData.get("chord-name") as string;
      const tuning = formData.get("chord-tuning") as string;
      const tabInputs = Array.from(form.querySelectorAll<HTMLInputElement>('input[name^="fret-"]'));
      const tab = tabInputs.map(input => (input.value.trim() === "" ? "x" : input.value.trim())).join("");
      if (name.trim() && tab.length === 6) {
        appActor.send({ type: "CREATE_CHORD", input: { name, tab, tuning } });
        form.reset();
      }
    }} class="space-y-4 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="md:col-span-1">
          <label for="chord-name" class=${labelClasses}>Chord Name</label>
          <input id="chord-name" name="chord-name" type="text" class=${baseInputClasses} placeholder="e.g., G Major" required />
        </div>
        <div class="md:col-span-2">
          <label for="chord-tuning" class=${labelClasses}>Tuning</label>
          <select id="chord-tuning" name="chord-tuning" class="${baseInputClasses}">
            ${savedTunings.map(tuning => html`<option .value=${tuning.name}>${tuning.name} (${tuning.notes})</option>`)}
          </select>
        </div>
      </div>
      <div>
        <label class=${labelClasses}>Tablature (Strings e B G D A E)</label>
        <div class="grid grid-cols-6 gap-2">
          ${[...Array(6)].map((_, i) => html`<input type="text" name="fret-${5 - i}" class="${baseInputClasses} font-mono text-center" maxlength="2" placeholder="x" />`)}
        </div>
      </div>
      <div class="flex justify-end"><button type="submit" class=${primaryButtonClasses}>Add Chord</button></div>
    </form>
    <div class="space-y-3">
      ${savedChords.map(chord => {
      // MODIFIED: Conditionally render edit form or display view
      if (editingChordId === chord.id) {
        return ChordEditorForm(chord, savedTunings);
      }

      const tuningNotes = tuningsMap.get(chord.tuning);
      const notes = tuningNotes ? calculateNotesFromTab(chord.tab, tuningNotes) : Array(6).fill("?");
      return html`
            <div class="p-3 bg-zinc-800 rounded">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="font-semibold text-zinc-300">${chord.name}</span>
                        <span class="text-sm text-zinc-500 ml-2">(${chord.tuning})</span>
                    </div>
                    <div class="flex items-center gap-4">
                      <div class="font-mono text-cyan-400 flex gap-x-2 text-lg">
                          ${chord.tab.split('').map(fret => html`<span>${fret}</span>`)}
                      </div>
                      <div class="flex gap-2">
                          <button @click=${() => { if (chord.id) appActor.send({ type: "EDIT_CHORD", id: chord.id }); }} class="${secondaryButtonClasses} h-8 px-3 text-xs">Edit</button>
                          <button @click=${() => { if (chord.id) appActor.send({ type: "DELETE_CHORD", id: chord.id }); }} class="${destructiveButtonClasses} h-8 px-3 text-xs">Delete</button>
                      </div>
                    </div>
                </div>
                <div class="font-mono text-amber-400 flex justify-end gap-x-2 text-sm mt-1">
                    ${notes.map(note => html`<span class="w-6 text-center">${note}</span>`)}
                </div>
            </div>
           `;
    })}
      ${savedChords.length === 0 ? html`<p class="text-zinc-500 text-center py-4">No chords saved yet.</p>` : nothing}
    </div>
  `;
};

const TuningManager = (savedTunings: SerializableTuning[]) => html`
  <h3 class="text-lg font-medium mb-4 text-zinc-50">Tuning Manager</h3>
  <form @submit=${(e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const name = formData.get("tuning-name") as string;
    const noteInputs = Array.from(form.querySelectorAll<HTMLInputElement>('input[name^="note-"]'));
    const notes = noteInputs.map(input => input.value).join(" ");
    if (name.trim() && notes.trim().split(" ").length === 6) {
      appActor.send({ type: "CREATE_TUNING", input: { name, notes } });
      form.reset();
    }
  }} class="space-y-4 mb-6 p-4 border border-zinc-800 rounded-lg">
    <h4 class="font-medium text-zinc-300">Add New Tuning</h4>
    <div>
      <label for="tuning-name" class=${labelClasses}>Tuning Name</label>
      <input id="tuning-name" name="tuning-name" type="text" class=${baseInputClasses} placeholder="e.g., Open C" required />
    </div>
    <div>
      <label class=${labelClasses}>Notes (6th to 1st string)</label>
      <div class="grid grid-cols-6 gap-2">
        ${[...Array(6)].map((_, i) => html`<input type="text" name="note-${i}" class="${baseInputClasses} font-mono text-center" maxlength="2" required />`)}
      </div>
    </div>
    <div class="flex justify-end"><button type="submit" class=${primaryButtonClasses}>Save Tuning</button></div>
  </form>
  <div class="space-y-2">
    ${savedTunings.map(tuning => html`
      <div class="flex items-center justify-between p-3 bg-zinc-800 rounded">
        <span class="font-semibold text-zinc-300">${tuning.name}</span>
        <span class="font-mono text-cyan-400">${tuning.notes}</span>
        <div class="flex gap-2">
          <button @click=${() => {
      // ✅ FIX: Check if tuning.id exists before sending the event
      if (tuning.id) {
        appActor.send({ type: "DELETE_TUNING", id: tuning.id });
      }
    }} class="${destructiveButtonClasses} h-8 px-3 text-xs">Delete</button>
        </div>
      </div>
    `)}
  </div>
`;

const AppShell = () => html`
  <div class="bg-zinc-950 text-zinc-50 min-h-screen font-sans">
    <div class="container mx-auto p-4 md:p-8 max-w-3xl">
      <header class="text-center mb-8">
        <h1 class="text-4xl font-bold tracking-tight text-zinc-50">Polyphonic Live Coder</h1>
        <p class="text-zinc-400 mt-2">Create, play, and save polyphonic patterns in real-time.</p>
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
      <div class="mt-8 ${cardClasses}">
        <div id="tuning-manager-container"></div>
      </div>
    </div>
    <div id="modal-container"></div>
  </div>
`;

// --- RENDER & SUBSCRIPTION ---
const appShellContainer = document.querySelector<HTMLElement>("#app-shell");
const errorContainer = document.querySelector<HTMLElement>("#error-container");
if (!appShellContainer || !errorContainer) throw new Error("Could not find root containers");
render(AppShell(), appShellContainer);

const editorContainer = document.querySelector<HTMLElement>("#editor-container");
const controlsContainer = document.querySelector<HTMLElement>("#controls-container");
const loaderContainer = document.querySelector<HTMLElement>("#loader-container");
const modalContainer = document.querySelector<HTMLElement>("#modal-container");
const chordBankContainer = document.querySelector<HTMLElement>("#chord-bank-container");
const tuningManagerContainer = document.querySelector<HTMLElement>("#tuning-manager-container");
if (!editorContainer || !controlsContainer || !loaderContainer || !modalContainer || !chordBankContainer || !tuningManagerContainer) throw new Error("Could not find component containers");

appActor.subscribe((snapshot) => {
  const viewMode = selectViewMode(snapshot);
  render(viewMode === "json" ? PatternEditor(selectCurrentPattern(snapshot)) : VisualEditor(selectCurrentPattern(snapshot)), editorContainer);
  render(Controls({ isAudioOn: selectIsAudioOn(snapshot), isSaving: selectIsSaving(snapshot), patternName: selectPatternName(snapshot), selectedPatternId: selectSelectedPatternId(snapshot), viewMode: viewMode }), controlsContainer);
  render(PatternLoader(selectSavedPatterns(snapshot), selectSelectedPatternId(snapshot)), loaderContainer);
  // MODIFIED: Pass the editingChordId to the ChordBank component
  render(ChordBank(selectSavedChords(snapshot), selectSavedTunings(snapshot), selectEditingChordId(snapshot)), chordBankContainer);
  render(TuningManager(selectSavedTunings(snapshot)), tuningManagerContainer);
  render(ErrorMessage(selectErrorMessage(snapshot)), errorContainer);
  render(selectIsShowDialog(snapshot) ? NewPatternDialog(selectNewPatternName(snapshot)) : html``, modalContainer);
});

// --- AUDIO SIDE-EFFECTS ---
function parseCode(code: string): NoteEvent[] {
  try { const parsed = JSON.parse(code); return Array.isArray(parsed) ? parsed : []; } catch (error) { return []; }
}
function updatePart(notes: NoteEvent[]) {
  part.clear();
  const indexedNotes = notes.map((note, index) => ({ ...note, index }));
  indexedNotes.forEach((noteEvent) => { part.add(noteEvent); });
}
let lastScheduledPattern = "";
appActor.subscribe((snapshot) => {
  if (selectIsAudioOn(snapshot)) {
    if (transport.state !== "started") startAudio().then(() => transport.start());
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
  if (el) { el.classList.add("highlight"); setTimeout(() => { el.classList.remove("highlight"); }, 150); }
}, []).start(0);
updatePart(parseCode(appActor.getSnapshot().context.currentPattern));
