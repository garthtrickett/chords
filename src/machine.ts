// src/machine.ts
import { setup, assign, type PromiseActorLogic } from "xstate";
import type { SerializablePattern } from "../types/app";

// 1. CONTEXT (State)
export interface AppContext {
  savedPatterns: SerializablePattern[];
  currentPattern: string;
  patternName: string;
  selectedPatternId: string | null;
  errorMessage: string | null;
  newPatternName: string;
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
      input: { id: string; name: string; content: string };
    }
  | { type: "done.invoke.fetchPatterns"; output: SerializablePattern[] }
  | { type: "error.platform.fetchPatterns"; error: unknown }
  | { type: "done.invoke.updatePattern" }
  | { type: "error.platform.updatePattern"; error: unknown }
  | { type: "done.invoke.createPattern"; output: SerializablePattern }
  | { type: "error.platform.createPattern"; error: unknown };

// 3. CONSTANTS
const defaultPattern = JSON.stringify(
  [
    { time: "0:0", note: "C4", duration: "8n" },
    { time: "0:1", note: "E4", duration: "8n" },
  ],
  null,
  2,
);

// 4. MACHINE DEFINITION (with setup)
export const appMachine = setup({
  // Define the machine's types for robust inference
  types: {} as {
    context: AppContext;
    events: AppEvent;
  },
  // Actor logic is defined here for strong typing
  actors: {
    fetchPatterns: {} as PromiseActorLogic<SerializablePattern[]>,
    createPattern: {} as PromiseActorLogic<
      SerializablePattern,
      { name: string; notes: string }
    >,
    updatePattern: {} as PromiseActorLogic<
      void,
      { id: string; name: string; content: string }
    >,
  },
}).createMachine({
  id: "polyphonicApp",
  initial: "initializing",
  context: {
    savedPatterns: [] as SerializablePattern[],
    currentPattern: defaultPattern,
    patternName: "",
    selectedPatternId: null,
    errorMessage: null,
    newPatternName: "",
  },
  states: {
    initializing: {
      invoke: {
        id: "fetchPatterns",
        src: "fetchPatterns",
        onDone: {
          target: "running",
          actions: assign({
            savedPatterns: ({ event }) => event.output,
            currentPattern: ({ event }) =>
              event.output.length > 0 ? event.output[0].notes : defaultPattern,
            patternName: ({ event }) =>
              event.output.length > 0 ? event.output[0].name : "",
            selectedPatternId: ({ event }) =>
              event.output.length > 0 ? event.output[0].id : null,
          }),
        },
        onError: {
          target: "running",
          actions: assign({
            errorMessage: ({ event }) => (event.error as Error).message,
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
                          (event.error as Error).message,
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
                          (event.error as Error).message,
                      }),
                    },
                  },
                },
                reloading: {
                  invoke: {
                    id: "reloadPatterns",
                    src: "fetchPatterns",
                    onDone: {
                      target: "idle",
                      actions: assign({
                        savedPatterns: ({ event }) => event.output,
                        errorMessage: null,
                      }),
                    },
                    onError: {
                      target: "idle",
                      actions: assign({
                        errorMessage: ({ event }) =>
                          (event.error as Error).message,
                      }),
                    },
                  },
                },
              },
            },
          },
          on: {
            NEW_PATTERN: "showingNewPatternDialog",
          },
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
  },
});
