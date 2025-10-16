// src/machine.ts
import { createMachine, assign, type PromiseActorLogic } from "xstate";
// MODIFIED: Import the new pattern type
import type { SerializablePattern } from "../types/database";

// 1. Define the context (extended state) of the machine
export interface AppContext {
  // MODIFIED: Renamed and re-typed from savedChords
  savedPatterns: SerializablePattern[];
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
  // MODIFIED: Event output now uses SerializablePattern[]
  | { type: "done.invoke.fetchPatterns"; output: SerializablePattern[] }
  | { type: "error.platform.fetchPatterns"; error: unknown }
  | { type: "done.invoke.savePattern" }
  | { type: "error.platform.savePattern"; error: unknown };

// A default polyphonic pattern to start with.
const defaultPattern = JSON.stringify(
  [
    { time: "0:0", note: "C4", duration: "8n" },
    { time: "0:1", note: "E4", duration: "8n" },
    { time: "0:2", note: "G4", duration: "8n" },
    { time: "0:3", note: "C5", duration: "8n" },
  ],
  null,
  2,
);

// 3. Create the state machine
export const appMachine = createMachine({
  id: "polyphonicApp",
  types: {} as {
    context: AppContext;
    events: AppEvent;
    actors:
      | {
          // MODIFIED: Renamed src to 'fetchPatterns'
          src: "fetchPatterns";
          logic: PromiseActorLogic<SerializablePattern[]>;
        }
      | {
          // MODIFIED: Renamed src to 'savePattern'
          src: "savePattern";
          logic: PromiseActorLogic<void, { name: string; content: string }>;
        };
  },
  initial: "initializing",
  context: {
    // MODIFIED: Renamed from savedChords
    savedPatterns: [],
    // MODIFIED: Use a valid JSON string as the default
    currentPattern: defaultPattern,
    patternName: "",
    errorMessage: null,
  },
  states: {
    initializing: {
      invoke: {
        // MODIFIED: Match the new src name
        id: "fetchPatterns",
        src: "fetchPatterns",
        onDone: {
          target: "running",
          actions: assign({
            // MODIFIED: Assign to savedPatterns
            savedPatterns: ({ event }) => event.output,
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
            idle: { on: { SAVE_PATTERN: "saving" } },
            saving: {
              invoke: {
                // MODIFIED: Match the new src name
                id: "savePattern",
                src: "savePattern",
                input: ({ event }) => {
                  if (event.type === "SAVE_PATTERN") {
                    return event.input;
                  }
                  // This should not happen, but provides a fallback
                  return { name: "", content: "" };
                },
                onDone: { target: "reloading" },
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
                // MODIFIED: Match the new src name for reloading
                id: "reloadPatterns",
                src: "fetchPatterns",
                onDone: {
                  target: "idle",
                  actions: assign({
                    savedPatterns: ({ event }) => event.output,
                    patternName: "", // Clear name after successful save
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
  // These top-level event handlers remain largely the same
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
          const selected = context.savedPatterns.find((p) => p.id === event.id);
          // MODIFIED: The pattern content is now in the `notes` property
          return selected ? selected.notes : context.currentPattern;
        },
        patternName: ({ context, event }) => {
          const selected = context.savedPatterns.find((p) => p.id === event.id);
          return selected ? selected.name : context.patternName;
        },
      }),
    },
  },
});
