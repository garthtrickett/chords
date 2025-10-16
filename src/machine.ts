// src/machine.ts
import { createMachine, assign, type PromiseActorLogic } from "xstate";
import type { SerializableChord } from "../types/database";

// 1. Define the context (extended state) of the machine
export interface AppContext {
  savedChords: SerializableChord[];
  currentPattern: string;
  patternName: string;
  errorMessage: string | null;
}

// 2. Define the events that can be sent to the machine
export type AppEvent =
  | { type: "START_AUDIO" }
  | { type: "STOP_AUDIO" }
  | { type: "LOAD_PATTERNS" }
  | { type: "SAVE_PATTERN"; input: { name: string; content: string } }
  | { type: "UPDATE_PATTERN"; value: string }
  | { type: "UPDATE_PATTERN_NAME"; value: string }
  | { type: "SELECT_PATTERN"; id: string }
  | { type: "done.invoke.fetchChords"; output: SerializableChord[] }
  | { type: "error.platform.fetchChords"; error: unknown }
  | { type: "done.invoke.saveChord" }
  | { type: "error.platform.saveChord"; error: unknown };

// 3. Create the state machine
export const appMachine = createMachine({
  id: "audioApp",
  types: {} as {
    context: AppContext;
    events: AppEvent;
    actors:
      | {
          src: "fetchChords";
          logic: PromiseActorLogic<SerializableChord[]>;
        }
      | {
          src: "saveChord";
          logic: PromiseActorLogic<void, { name: string; content: string }>;
        };
  },
  initial: "initializing",
  context: {
    savedChords: [],
    currentPattern: "C4 D4 E4 G4",
    patternName: "",
    errorMessage: null,
  },
  states: {
    initializing: {
      invoke: {
        id: "fetchChords",
        src: "fetchChords",
        onDone: {
          target: "running", // MODIFIED: Transition to the main 'running' state
          actions: assign({
            savedChords: ({ event }) => event.output,
          }),
        },
        onError: {
          target: "running", // MODIFIED: Still go to running, but with an error
          actions: assign({
            errorMessage: ({ event }) => (event.error as Error).message,
          }),
        },
      },
    },
    // NEW: A parallel state to manage audio and saving independently.
    running: {
      type: "parallel",
      states: {
        // This state group handles only the audio status.
        audio: {
          initial: "off",
          states: {
            off: {
              on: {
                START_AUDIO: "on",
              },
            },
            on: {
              on: {
                STOP_AUDIO: "off",
              },
            },
          },
        },
        // This state group handles only the saving status.
        saveStatus: {
          initial: "idle",
          states: {
            idle: {
              on: {
                SAVE_PATTERN: "saving",
              },
            },
            saving: {
              invoke: {
                id: "saveChord",
                src: "saveChord",
                input: ({ event }) => {
                  if (event.type === "SAVE_PATTERN") {
                    return event.input;
                  }
                  return { name: "", content: "" };
                },
                onDone: {
                  target: "reloading",
                },
                onError: {
                  target: "idle",
                  actions: assign({
                    errorMessage: ({ event }) => (event.error as Error).message,
                  }),
                },
              },
            },
            reloading: {
              invoke: {
                id: "reloadChords",
                src: "fetchChords",
                onDone: {
                  target: "idle",
                  actions: assign({
                    savedChords: ({ event }) => event.output,
                    patternName: "",
                    errorMessage: null,
                  }),
                },
                onError: {
                  target: "idle",
                  actions: assign({
                    errorMessage: ({ event }) => (event.error as Error).message,
                  }),
                },
              },
            },
          },
        },
      },
    },
  },
  on: {
    UPDATE_PATTERN: {
      actions: assign({
        currentPattern: ({ event }) => event.value,
      }),
    },
    UPDATE_PATTERN_NAME: {
      actions: assign({
        patternName: ({ event }) => event.value,
      }),
    },
    SELECT_PATTERN: {
      actions: assign({
        currentPattern: ({ context, event }) => {
          const selected = context.savedChords.find((c) => c.id === event.id);
          return selected
            ? selected.name.split(": ")[1] || ""
            : context.currentPattern;
        },
        patternName: ({ context, event }) => {
          const selected = context.savedChords.find((c) => c.id === event.id);
          return selected
            ? selected.name.split(": ")[0] || ""
            : context.patternName;
        },
      }),
    },
  },
});
