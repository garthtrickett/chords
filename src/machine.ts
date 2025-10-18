// src/machine.ts
import { setup, assign, type PromiseActorLogic } from "xstate";
import type {
  SerializablePattern,
  SerializableChord,
  SerializableTuning,
  NoteEvent,
} from "../types/app";

// 1. CONTEXT (State)
export interface AppContext {
  savedPatterns: SerializablePattern[];
  savedChords: SerializableChord[];
  savedTunings: SerializableTuning[];
  currentPattern: string;
  patternName: string;
  selectedPatternId: string | null;
  errorMessage: string | null;
  newPatternName: string;
  editingChordId: string | null;
  editingTuningId: string | null;
  keyRoot: string;
  keyType: "major" | "minor";
  chordBankFilterKey: string | null;
  chordBankFilterTuning: string | null;
}

// 2. EVENTS
export type AppEvent =
  | { type: "START_AUDIO" }
  | { type: "STOP_AUDIO" }
  | { type: "UPDATE_PATTERN"; value: string }
  | { type: "UPDATE_PATTERN_NAME"; value: string }
  | { type: "SELECT_PATTERN"; id: string }
  | { type: "NEW_PATTERN" }
  | { type: "CANCEL_NEW_PATTERN" }
  | { type: "UPDATE_NEW_PATTERN_NAME"; value: string }
  | { type: "CREATE_PATTERN"; name: string }
  | {
    type: "UPDATE_SAVED_PATTERN";
    input: {
      id: string;
      name: string;
      content: string;
      key_root: string;
      key_type: string;
    };
  }
  | { type: "DELETE_PATTERN"; id: string }
  | { type: "TOGGLE_VIEW" }
  | { type: "CREATE_CHORD"; input: { name: string; tab: string; tuning: string } }
  | { type: "EDIT_CHORD"; id: string }
  | { type: "CANCEL_EDIT_CHORD" }
  | {
    type: "UPDATE_CHORD";
    input: { id: string; name: string; tab: string; tuning: string };
  }
  | { type: "DELETE_CHORD"; id: string }
  | { type: "CREATE_TUNING"; input: { name: string; notes: string } }
  | {
    type: "UPDATE_TUNING";
    input: { id: string; name: string; notes: string };
  }
  | { type: "DELETE_TUNING"; id: string }
  | { type: "EDIT_TUNING"; id: string }
  | { type: "CANCEL_EDIT_TUNING" }
  | { type: "LOAD_CHORD_INTO_PATTERN"; chordId: string }
  | { type: "SET_KEY_ROOT"; root: string }
  | { type: "SET_KEY_TYPE"; keyType: "major" | "minor" }
  | { type: "SET_CHORD_BANK_FILTER"; key: string }
  | { type: "SET_CHORD_BANK_FILTER_TUNING"; tuning: string }
  | { type: "CLEAR_CHORD_BANK_FILTERS" }
  | {
    type: "done.invoke.fetchInitialData";
    output: {
      patterns: SerializablePattern[];
      chords: SerializableChord[];
      tunings: SerializableTuning[];
    };
  }
  | { type: "error.platform.fetchInitialData"; error: unknown }
  | { type: "done.invoke.updatePattern" }
  | { type: "error.platform.updatePattern"; error: unknown }
  | { type: "done.invoke.createPattern"; output: SerializablePattern }
  | { type: "error.platform.createPattern"; error: unknown }
  | { type: "done.invoke.deletePattern" }
  | { type: "error.platform.deletePattern"; error: unknown }
  | { type: "done.invoke.createChord"; output: SerializableChord }
  | { type: "error.platform.createChord"; error: unknown }
  | { type: "done.invoke.updateChord" }
  | { type: "error.platform.updateChord"; error: unknown }
  | { type: "done.invoke.deleteChord" }
  | { type: "error.platform.deleteChord"; error: unknown }
  | { type: "done.invoke.createTuning"; output: SerializableTuning }
  | { type: "error.platform.createTuning"; error: unknown }
  | { type: "done.invoke.updateTuning" }
  | { type: "error.platform.updateTuning"; error: unknown }
  | { type: "done.invoke.deleteTuning" }
  | { type: "error.platform.deleteTuning"; error: unknown };

// 3. CONSTANTS
const defaultPattern = JSON.stringify([], null, 2);
const getErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "message" in error)
    return String(error.message);
  return "An unexpected error occurred.";
};

// --- HELPERS for chord logic ---
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_MAP: Record<string, number> = {
  "C": 0,
  "C#": 1,
  "Db": 1,
  "D": 2,
  "D#": 3,
  "Eb": 3,
  "E": 4,
  "F": 5,
  "F#": 6,
  "Gb": 6,
  "G": 7,
  "G#": 8,
  "Ab": 8,
  "A": 9,
  "A#": 10,
  "Bb": 10,
  "B": 11,
};
function calculateChordNotes(tab: string, tuningNotes: string[]): string[] {
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

// 4. MACHINE DEFINITION (with setup)
export const appMachine = setup({
  types: {} as { context: AppContext; events: AppEvent },
  actors: {
    fetchInitialData: {} as PromiseActorLogic<{
      patterns: SerializablePattern[];
      chords: SerializableChord[];
      tunings: SerializableTuning[];
    }>,
    createPattern: {} as PromiseActorLogic<
      SerializablePattern,
      { name: string; notes: string; key_root: string; key_type: string }
    >,
    updatePattern: {} as PromiseActorLogic<
      void,
      { id: string; name: string; content: string; key_root: string; key_type: string }
    >,
    deletePattern: {} as PromiseActorLogic<void, { id: string }>,
    createChord: {} as PromiseActorLogic<
      SerializableChord,
      { name: string; tab: string; tuning: string }
    >,
    updateChord: {} as PromiseActorLogic<
      void,
      { id: string; name: string; tab: string; tuning: string }
    >,
    deleteChord: {} as PromiseActorLogic<void, { id: string }>,
    createTuning: {} as PromiseActorLogic<
      SerializableTuning,
      { name: string; notes: string }
    >,
    updateTuning: {} as PromiseActorLogic<
      void,
      { id: string; name: string; notes: string }
    >,
    deleteTuning: {} as PromiseActorLogic<void, { id: string }>,
  },
}).createMachine({
  id: "polyphonicApp",
  initial: "initializing",
  context: {
    savedPatterns: [],
    savedChords: [],
    savedTunings: [],
    currentPattern: defaultPattern,
    patternName: "",
    selectedPatternId: null,
    errorMessage: null,
    newPatternName: "",
    editingChordId: null,
    editingTuningId: null,
    keyRoot: "C",
    keyType: "major",
    chordBankFilterKey: null,
    chordBankFilterTuning: null,
  },
  states: {
    initializing: {
      invoke: {
        id: "fetchInitialData",
        src: "fetchInitialData",
        onDone: {
          target: "running",
          actions: assign({
            savedPatterns: ({ event }) => event.output.patterns,
            savedChords: ({ event }) => event.output.chords,
            savedTunings: ({ event }) => event.output.tunings,
            currentPattern: ({ event }) =>
              event.output.patterns.length > 0
                ? event.output.patterns[0].notes
                : defaultPattern,
            patternName: ({ event }) =>
              event.output.patterns.length > 0
                ? event.output.patterns[0].name
                : "",
            selectedPatternId: ({ event }) =>
              event.output.patterns.length > 0
                ? event.output.patterns[0].id
                : null,
            keyRoot: ({ event }) =>
              event.output.patterns.length > 0
                ? event.output.patterns[0].key_root
                : "C",
            keyType: ({ event }) =>
              event.output.patterns.length > 0
                ? (event.output.patterns[0].key_type as "major" | "minor")
                : "major",
          }),
        },
        onError: {
          target: "running",
          actions: assign({
            errorMessage: ({ event }) => getErrorMessage(event.error),
          }),
        },
      },
    },
    running: {
      initial: "editing",
      states: {
        editing: {
          type: "parallel",
          states: {
            audio: {
              initial: "off",
              states: {
                off: { on: { START_AUDIO: "on" } },
                on: { on: { STOP_AUDIO: "off" } },
              },
            },
            saveStatus: {
              initial: "idle",
              states: {
                idle: {
                  on: {
                    UPDATE_SAVED_PATTERN: "updating",
                    CREATE_PATTERN: "creating",
                    DELETE_PATTERN: "deletingPattern",
                    CREATE_CHORD: "creatingChord",
                    UPDATE_CHORD: "updatingChord",
                    DELETE_CHORD: "deletingChord",
                    CREATE_TUNING: "creatingTuning",
                    UPDATE_TUNING: "updatingTuning",
                    DELETE_TUNING: "deletingTuning",
                  },
                },
                updating: {
                  invoke: {
                    id: "updatePattern",
                    src: "updatePattern",
                    input: ({ event }) => {
                      if (event.type === "UPDATE_SAVED_PATTERN")
                        return event.input;
                      throw new Error("Invalid event for actor");
                    },
                    onDone: "reloading",
                    onError: {
                      target: "idle",
                      actions: assign({
                        errorMessage: ({ event }) =>
                          getErrorMessage(event.error),
                      }),
                    },
                  },
                },
                creating: {
                  invoke: {
                    id: "createPattern",
                    src: "createPattern",
                    input: ({ context, event }) => {
                      if (event.type === "CREATE_PATTERN")
                        return {
                          name: event.name,
                          notes: defaultPattern,
                          key_root: context.keyRoot,
                          key_type: context.keyType,
                        };
                      throw new Error("Invalid event for actor");
                    },
                    onDone: {
                      target: "reloading",
                      actions: assign({
                        selectedPatternId: ({ event }) => event.output.id,
                        patternName: ({ event }) => event.output.name,
                        currentPattern: ({ event }) => event.output.notes,
                        keyRoot: ({ event }) => event.output.key_root,
                        keyType: ({ event }) =>
                          event.output.key_type as "major" | "minor",
                      }),
                    },
                    onError: {
                      target: "idle",
                      actions: assign({
                        errorMessage: ({ event }) =>
                          getErrorMessage(event.error),
                      }),
                    },
                  },
                },
                deletingPattern: {
                  invoke: {
                    id: "deletePattern",
                    src: "deletePattern",
                    input: ({ event }) => {
                      if (event.type === "DELETE_PATTERN")
                        return { id: event.id };
                      throw new Error("Invalid event for actor");
                    },
                    onDone: "reloadingAndResetting",
                    onError: {
                      target: "idle",
                      actions: assign({
                        errorMessage: ({ event }) =>
                          getErrorMessage(event.error),
                      }),
                    },
                  },
                },
                creatingChord: {
                  invoke: {
                    id: "createChord",
                    src: "createChord",
                    input: ({ event }) => {
                      if (event.type === "CREATE_CHORD") return event.input;
                      throw new Error("Invalid event for actor");
                    },
                    onDone: "reloading",
                    onError: {
                      target: "idle",
                      actions: assign({
                        errorMessage: ({ event }) =>
                          getErrorMessage(event.error),
                      }),
                    },
                  },
                },
                updatingChord: {
                  invoke: {
                    id: "updateChord",
                    src: "updateChord",
                    input: ({ event }) => {
                      if (event.type === "UPDATE_CHORD") return event.input;
                      throw new Error("Invalid event for actor");
                    },
                    onDone: "reloading",
                    onError: {
                      target: "idle",
                      actions: assign({
                        errorMessage: ({ event }) =>
                          getErrorMessage(event.error),
                      }),
                    },
                  },
                },
                deletingChord: {
                  invoke: {
                    id: "deleteChord",
                    src: "deleteChord",
                    input: ({ event }) => {
                      if (event.type === "DELETE_CHORD")
                        return { id: event.id };
                      throw new Error("Invalid event for actor");
                    },
                    onDone: "reloading",
                    onError: {
                      target: "idle",
                      actions: assign({
                        errorMessage: ({ event }) =>
                          getErrorMessage(event.error),
                      }),
                    },
                  },
                },
                creatingTuning: {
                  invoke: {
                    id: "createTuning",
                    src: "createTuning",
                    input: ({ event }) => {
                      if (event.type === "CREATE_TUNING") return event.input;
                      throw new Error("Invalid event for actor");
                    },
                    onDone: "reloading",
                    onError: {
                      target: "idle",
                      actions: assign({
                        errorMessage: ({ event }) =>
                          getErrorMessage(event.error),
                      }),
                    },
                  },
                },
                updatingTuning: {
                  invoke: {
                    id: "updateTuning",
                    src: "updateTuning",
                    input: ({ event }) => {
                      if (event.type === "UPDATE_TUNING") return event.input;
                      throw new Error("Invalid event for actor");
                    },
                    onDone: "reloading",
                    onError: {
                      target: "idle",
                      actions: assign({
                        errorMessage: ({ event }) =>
                          getErrorMessage(event.error),
                      }),
                    },
                  },
                },
                deletingTuning: {
                  invoke: {
                    id: "deleteTuning",
                    src: "deleteTuning",
                    input: ({ event }) => {
                      if (event.type === "DELETE_TUNING")
                        return { id: event.id };
                      throw new Error("Invalid event for actor");
                    },
                    onDone: "reloading",
                    onError: {
                      target: "idle",
                      actions: assign({
                        errorMessage: ({ event }) =>
                          getErrorMessage(event.error),
                      }),
                    },
                  },
                },
                reloading: {
                  invoke: {
                    id: "reloadInitialData",
                    src: "fetchInitialData",
                    onDone: {
                      target: "idle",
                      actions: assign({
                        savedPatterns: ({ event }) => event.output.patterns,
                        savedChords: ({ event }) => event.output.chords,
                        savedTunings: ({ event }) => event.output.tunings,
                        errorMessage: null,
                        editingChordId: null,
                        editingTuningId: null,
                      }),
                    },
                    onError: {
                      target: "idle",
                      actions: assign({
                        errorMessage: ({ event }) =>
                          getErrorMessage(event.error),
                      }),
                    },
                  },
                },
                reloadingAndResetting: {
                  invoke: {
                    id: "reloadInitialDataAfterDelete",
                    src: "fetchInitialData",
                    onDone: {
                      target: "idle",
                      actions: assign({
                        savedPatterns: ({ event }) => event.output.patterns,
                        savedChords: ({ event }) => event.output.chords,
                        savedTunings: ({ event }) => event.output.tunings,
                        errorMessage: null,
                        editingChordId: null,
                        editingTuningId: null,
                        currentPattern: defaultPattern,
                        patternName: "",
                        selectedPatternId: null,
                        keyRoot: "C",
                        keyType: "major",
                      }),
                    },
                    onError: {
                      target: "idle",
                      actions: assign({
                        errorMessage: ({ event }) =>
                          getErrorMessage(event.error),
                      }),
                    },
                  },
                },
              },
            },
            viewMode: {
              initial: "json",
              states: {
                json: { on: { TOGGLE_VIEW: "visual" } },
                visual: { on: { TOGGLE_VIEW: "json" } },
              },
            },
          },
          on: { NEW_PATTERN: "showingNewPatternDialog" },
        },
        showingNewPatternDialog: {
          on: {
            CANCEL_NEW_PATTERN: {
              target: "editing.saveStatus.idle",
            },
            CREATE_PATTERN: {
              target: "editing.saveStatus.creating",
              actions: assign({ newPatternName: "" }),
            },
          },
        },
      },
    },
  },
  on: {
    UPDATE_PATTERN: {
      actions: assign({ currentPattern: ({ event }) => event.value }),
    },
    UPDATE_PATTERN_NAME: {
      actions: assign({ patternName: ({ event }) => event.value }),
    },
    UPDATE_NEW_PATTERN_NAME: {
      actions: assign({ newPatternName: ({ event }) => event.value }),
    },
    SELECT_PATTERN: {
      actions: assign({
        currentPattern: ({ context, event }) => {
          const selected = context.savedPatterns.find((p) => p.id === event.id);
          return selected ? selected.notes : context.currentPattern;
        },
        patternName: ({ context, event }) => {
          const selected = context.savedPatterns.find((p) => p.id === event.id);
          return selected ? selected.name : context.patternName;
        },
        selectedPatternId: ({ event }) => event.id,
        keyRoot: ({ context, event }) => {
          const selected = context.savedPatterns.find((p) => p.id === event.id);
          return selected ? selected.key_root : context.keyRoot;
        },
        keyType: ({ context, event }) => {
          const selected = context.savedPatterns.find((p) => p.id === event.id);
          return selected
            ? (selected.key_type as "major" | "minor")
            : context.keyType;
        },
      }),
    },
    EDIT_CHORD: {
      actions: assign({ editingChordId: ({ event }) => event.id }),
    },
    CANCEL_EDIT_CHORD: {
      actions: assign({ editingChordId: null }),
    },
    EDIT_TUNING: {
      actions: assign({ editingTuningId: ({ event }) => event.id }),
    },
    CANCEL_EDIT_TUNING: {
      actions: assign({ editingTuningId: null }),
    },
    LOAD_CHORD_INTO_PATTERN: {
      actions: assign({
        currentPattern: ({ context, event }) => {
          const chord = context.savedChords.find((c) => c.id === event.chordId);
          if (!chord) return context.currentPattern;

          const tuning = context.savedTunings.find(
            (t) => t.name === chord.tuning,
          );
          if (!tuning) return context.currentPattern;

          const tuningNotes = tuning.notes.split(" ");
          const chordNotes = calculateChordNotes(chord.tab, tuningNotes).filter(
            (n) => n !== "x" && n !== "?",
          );

          let existingPattern: NoteEvent[] = [];
          try {
            const parsed = JSON.parse(context.currentPattern);
            if (Array.isArray(parsed)) existingPattern = parsed;
          } catch (e) {
            // Start with an empty pattern if current one is invalid
          }

          let maxBar = -1;
          existingPattern.forEach((note) => {
            if (typeof note.time === "string") {
              const match = note.time.match(/^(\d+):/);
              if (match) {
                const bar = parseInt(match[1], 10);
                if (bar > maxBar) maxBar = bar;
              }
            }
          });
          const newTime = `${maxBar + 1}:0`;

          const newNoteEvents: NoteEvent[] = chordNotes.map((noteName) => ({
            time: newTime,
            note: `${noteName}4`, // Add default octave 4
            duration: "4n", // Default to a quarter note
          }));
          const updatedPattern = [...existingPattern, ...newNoteEvents];
          return JSON.stringify(updatedPattern, null, 2);
        },
      }),
    },
    SET_KEY_ROOT: {
      actions: assign({ keyRoot: ({ event }) => event.root }),
    },
    SET_KEY_TYPE: {
      actions: assign({ keyType: ({ event }) => event.keyType }),
    },
    SET_CHORD_BANK_FILTER: {
      actions: assign({ chordBankFilterKey: ({ event }) => event.key || null }),
    },
    SET_CHORD_BANK_FILTER_TUNING: {
      actions: assign({
        chordBankFilterTuning: ({ event }) => event.tuning || null,
      }),
    },
    CLEAR_CHORD_BANK_FILTERS: {
      actions: assign({ chordBankFilterKey: null, chordBankFilterTuning: null }),
    },
  },
});
