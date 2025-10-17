// src/machine.ts
import { setup, assign, type PromiseActorLogic } from "xstate";
import type { SerializablePattern, SerializableChord, SerializableTuning } from "../types/app";

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
  editingTuningId: string | null; // NEW: Track which tuning is being edited
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
  | { type: "UPDATE_SAVED_PATTERN"; input: { id: string; name: string; content: string } }
  | { type: "TOGGLE_VIEW" }
  | { type: "CREATE_CHORD"; input: { name: string; tab: string; tuning: string } }
  | { type: "EDIT_CHORD"; id: string }
  | { type: "CANCEL_EDIT_CHORD" }
  | { type: "UPDATE_CHORD"; input: { id: string; name: string; tab: string; tuning: string } }
  | { type: "DELETE_CHORD"; id: string }
  | { type: "CREATE_TUNING"; input: { name: string; notes: string } }
  | { type: "UPDATE_TUNING"; input: { id: string; name: string; notes: string } }
  | { type: "DELETE_TUNING"; id: string }
  // NEW: Events for editing and canceling tuning edits
  | { type: "EDIT_TUNING"; id: string }
  | { type: "CANCEL_EDIT_TUNING" }
  | { type: "done.invoke.fetchInitialData"; output: { patterns: SerializablePattern[], chords: SerializableChord[], tunings: SerializableTuning[] } }
  | { type: "error.platform.fetchInitialData"; error: unknown }
  | { type: "done.invoke.updatePattern" }
  | { type: "error.platform.updatePattern"; error: unknown }
  | { type: "done.invoke.createPattern"; output: SerializablePattern }
  | { type: "error.platform.createPattern"; error: unknown }
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
const defaultPattern = JSON.stringify(
  [{ time: "0:0", note: "C4", duration: "8n" }, { time: "0:1", note: "E4", duration: "8n" }], null, 2
);

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "message" in error) return String(error.message);
  return "An unexpected error occurred.";
};

// 4. MACHINE DEFINITION (with setup)
export const appMachine = setup({
  types: {} as { context: AppContext; events: AppEvent; },
  actors: {
    fetchInitialData: {} as PromiseActorLogic<{ patterns: SerializablePattern[], chords: SerializableChord[], tunings: SerializableTuning[] }>,
    createPattern: {} as PromiseActorLogic<SerializablePattern, { name: string; notes: string }>,
    updatePattern: {} as PromiseActorLogic<void, { id: string; name: string; content: string }>,
    createChord: {} as PromiseActorLogic<SerializableChord, { name: string; tab: string; tuning: string }>,
    updateChord: {} as PromiseActorLogic<void, { id: string; name: string; tab: string; tuning: string }>,
    deleteChord: {} as PromiseActorLogic<void, { id: string }>,
    createTuning: {} as PromiseActorLogic<SerializableTuning, { name: string; notes: string }>,
    updateTuning: {} as PromiseActorLogic<void, { id: string; name: string; notes: string }>,
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
    editingTuningId: null, // NEW: Initialize editingTuningId
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
            currentPattern: ({ event }) => event.output.patterns.length > 0 ? event.output.patterns[0].notes : defaultPattern,
            patternName: ({ event }) => event.output.patterns.length > 0 ? event.output.patterns[0].name : "",
            selectedPatternId: ({ event }) => event.output.patterns.length > 0 ? event.output.patterns[0].id : null,
          }),
        },
        onError: {
          target: "running",
          actions: assign({ errorMessage: ({ event }) => getErrorMessage(event.error) }),
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
                    input: ({ event }) => {
                      if (event.type === "CREATE_PATTERN")
                        return { name: event.name, notes: defaultPattern };
                      throw new Error("Invalid event for actor");
                    },
                    onDone: {
                      target: "reloading",
                      actions: assign({
                        selectedPatternId: ({ event }) => event.output.id,
                        patternName: ({ event }) => event.output.name,
                        currentPattern: ({ event }) => event.output.notes,
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
                        errorMessage: ({ event }) => getErrorMessage(event.error),
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
                      actions: assign({ errorMessage: ({ event }) => getErrorMessage(event.error) }),
                    },
                  },
                },
                deletingChord: {
                  invoke: {
                    id: "deleteChord",
                    src: "deleteChord",
                    input: ({ event }) => {
                      if (event.type === "DELETE_CHORD") return { id: event.id };
                      throw new Error("Invalid event for actor");
                    },
                    onDone: "reloading",
                    onError: {
                      target: "idle",
                      actions: assign({ errorMessage: ({ event }) => getErrorMessage(event.error) }),
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
                    onError: { target: "idle", actions: assign({ errorMessage: ({ event }) => getErrorMessage(event.error) }) },
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
                    onError: { target: "idle", actions: assign({ errorMessage: ({ event }) => getErrorMessage(event.error) }) },
                  },
                },
                deletingTuning: {
                  invoke: {
                    id: "deleteTuning",
                    src: "deleteTuning",
                    input: ({ event }) => {
                      if (event.type === "DELETE_TUNING") return { id: event.id };
                      throw new Error("Invalid event for actor");
                    },
                    onDone: "reloading",
                    onError: { target: "idle", actions: assign({ errorMessage: ({ event }) => getErrorMessage(event.error) }) },
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
                        editingTuningId: null, // NEW: Reset editing state on reload
                      }),
                    },
                    onError: { target: "idle", actions: assign({ errorMessage: ({ event }) => getErrorMessage(event.error) }) },
                  },
                },
              },
            },
            viewMode: { initial: "json", states: { json: { on: { TOGGLE_VIEW: "visual" } }, visual: { on: { TOGGLE_VIEW: "json" } } } },
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
      }),
    },
    EDIT_CHORD: {
      actions: assign({ editingChordId: ({ event }) => event.id }),
    },
    CANCEL_EDIT_CHORD: {
      actions: assign({ editingChordId: null }),
    },
    // NEW: Handlers for tuning editing UI
    EDIT_TUNING: {
      actions: assign({ editingTuningId: ({ event }) => event.id }),
    },
    CANCEL_EDIT_TUNING: {
      actions: assign({ editingTuningId: null }),
    },
  },
});
