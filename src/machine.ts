// src/machine.ts
import { setup, assign, type PromiseActorLogic } from "xstate";
import { nanoid } from "nanoid";
import type {
  SerializablePattern,
  SerializableChord,
  SerializableTuning,
  NoteEvent,
  PatternSection,
  Measure,
} from "../types/app";
// 1. CONTEXT (State)
export interface AppContext {
  savedPatterns: SerializablePattern[];
  savedChords: SerializableChord[];
  savedTunings: SerializableTuning[];
  currentPattern: PatternSection[];
  patternName: string;
  selectedPatternId: string | null;
  errorMessage: string | null;
  newPatternName: string;
  editingChordId: string | null;
  editingTuningId: string | null;
  keyRoot: string;
  keyType: "major" | "minor";
  instrument: "piano" | "guitar";
  chordBankFilterKey: string | null;
  chordBankFilterTuning: string | null;
  chordPalette: string[];
  activeSlot: {
    sectionId: string;
    measureId: string;
    slotIndex: number;
  } | null;
}

// 2. EVENTS
export type AppEvent =
  | { type: "START_AUDIO" }
  | { type: "STOP_AUDIO" }
  | { type: "UPDATE_PATTERN_STRUCTURE"; value: PatternSection[] }
  | { type: "ADD_SECTION" }
  | { type: "ADD_MEASURE"; sectionId: string }
  | { type: "UPDATE_SECTION_TIME_SIGNATURE"; sectionId: string; timeSignature: string }
  | { type: "DELETE_SECTION"; sectionId: string }
  | { type: "SELECT_SLOT"; sectionId: string; measureId: string; slotIndex: number }
  | { type: "HIGHLIGHT_SLOT"; sectionId: string; measureId: string; slotIndex: number }
  | { type: "CLEAR_SLOT"; sectionId: string; measureId: string; slotIndex: number }
  | { type: "CLEAR_SLOT_SELECTION" }
  | { type: "TOGGLE_CHORD_IN_PALETTE"; chordId: string }
  | { type: "ASSIGN_CHORD_TO_SLOT"; chordId: string }
  | { type: "CANCEL_CHORD_SELECTION" }
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
      chord_palette: string;
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
  | { type: "SET_KEY_ROOT"; root: string }
  | { type: "SET_KEY_TYPE"; keyType: "major" | "minor" }
  | { type: "SET_INSTRUMENT"; instrument: "piano" | "guitar" }
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
const defaultPattern: PatternSection[] = [];
const getErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "message" in error)
    return String(error.message);
  return "An unexpected error occurred.";
};

const safeParsePattern = (notesJson: string): PatternSection[] => {
  try {
    const parsed = JSON.parse(notesJson);
    if (Array.isArray(parsed)) {
      if (
        parsed.length === 0 ||
        (parsed[0] && parsed[0].id && parsed[0].timeSignature && parsed[0].measures)
      ) {
        return parsed;
      }
    }
    return [];
  } catch (e) {
    return [];
  }
};
const getSlotsForTimeSignature = (timeSignature: string): number => {
  const [beats, beatType] = timeSignature.split("/").map(Number);
  if (beatType === 8) {
    return beats * 2; // Each 8th note gets two 16th note slots
  }
  return beats * 4; // Each 4th note gets four 16th note slots
};

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
      { name: string; notes: string; key_root: string; key_type: string; chord_palette: string }
    >,
    updatePattern: {} as PromiseActorLogic<
      void,
      {
        id: string;
        name: string;
        content: string;
        key_root: string;
        key_type: string;
        chord_palette: string;
      }
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
    instrument: "piano",
    chordBankFilterKey: null,
    chordBankFilterTuning: null,
    chordPalette: [],
    activeSlot: null,
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
                ? safeParsePattern(event.output.patterns[0].notes)
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
            chordPalette: ({ event }) => {
              if (event.output.patterns.length > 0) {
                try {
                  const palette = JSON.parse(
                    event.output.patterns[0].chord_palette,
                  );
                  return Array.isArray(palette) ? palette : [];
                } catch (e) {
                  return [];
                }
              }
              return [];
            },
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
                          notes: JSON.stringify(defaultPattern),
                          key_root: context.keyRoot,
                          key_type: context.keyType,
                          chord_palette: JSON.stringify(context.chordPalette),
                        };
                      throw new Error("Invalid event for actor");
                    },
                    onDone: {
                      target: "reloading",
                      actions: assign({
                        selectedPatternId: ({ event }) => event.output.id,
                        patternName: ({ event }) => event.output.name,
                        currentPattern: ({ event }) =>
                          safeParsePattern(event.output.notes),
                        keyRoot: ({ event }) => event.output.key_root,
                        keyType: ({ event }) =>
                          event.output.key_type as "major" | "minor",
                        chordPalette: [],
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
                        activeSlot: null,
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
              initial: "visual",
              states: {
                json: { on: { TOGGLE_VIEW: "visual" } },
                visual: { on: { TOGGLE_VIEW: "json" } },
              },
            },
          },
          on: {
            NEW_PATTERN: "showingNewPatternDialog",
            SELECT_SLOT: {
              target: "selectingChordForSlot",
              actions: assign({
                activeSlot: ({ event }) => ({
                  sectionId: event.sectionId,
                  measureId: event.measureId,
                  slotIndex: event.slotIndex,
                }),
              }),
            },
          },
        },
        showingNewPatternDialog: {
          on: {
            CANCEL_NEW_PATTERN: "editing",
            CREATE_PATTERN: "editing.saveStatus.creating",
          },
        },
        selectingChordForSlot: {
          on: {
            ASSIGN_CHORD_TO_SLOT: {
              target: "editing",
              actions: [
                assign({
                  currentPattern: ({ context, event }) => {
                    const { activeSlot } = context;
                    if (!activeSlot) return context.currentPattern;
                    return context.currentPattern.map((section) => {
                      if (section.id === activeSlot.sectionId) {
                        return {
                          ...section,
                          measures: section.measures.map((measure) => {
                            if (measure.id === activeSlot.measureId) {
                              const newSlots = [...measure.slots];
                              newSlots[activeSlot.slotIndex] = event.chordId;
                              return { ...measure, slots: newSlots };
                            }
                            return measure;
                          }),
                        };
                      }
                      return section;
                    });
                  },
                }),
                assign({ activeSlot: null }),
              ],
            },
            CLEAR_SLOT: {
              target: "editing",
              actions: [
                assign({
                  currentPattern: ({ context, event }) => {
                    return context.currentPattern.map((section) => {
                      if (section.id === event.sectionId) {
                        return {
                          ...section,
                          measures: section.measures.map((measure) => {
                            if (measure.id === event.measureId) {
                              const newSlots = [...measure.slots];
                              newSlots[event.slotIndex] = null;
                              return { ...measure, slots: newSlots };
                            }
                            return measure;
                          }),
                        };
                      }
                      return section;
                    });
                  },
                }),
                assign({ activeSlot: null }),
              ],
            },
            CANCEL_CHORD_SELECTION: {
              target: "editing",
              actions: assign({ activeSlot: null }),
            },
          },
        },
      },
    },
  },
  on: {
    UPDATE_PATTERN_STRUCTURE: {
      actions: assign({ currentPattern: ({ event }) => event.value }),
    },
    ADD_SECTION: {
      actions: assign({
        currentPattern: ({ context }) => {
          const slots = getSlotsForTimeSignature("4/4");
          return [
            ...context.currentPattern,
            {
              id: nanoid(),
              timeSignature: "4/4",
              measures: [{ id: nanoid(), slots: Array(slots).fill(null) }],
            },
          ];
        },
      }),
    },
    ADD_MEASURE: {
      actions: assign({
        currentPattern: ({ context, event }) => {
          return context.currentPattern.map((section) => {
            if (section.id === event.sectionId) {
              const slots = getSlotsForTimeSignature(section.timeSignature);
              const newMeasure: Measure = {
                id: nanoid(),
                slots: Array(slots).fill(null),
              };
              return {
                ...section,
                measures: [...section.measures, newMeasure],
              };
            }
            return section;
          });
        },
      }),
    },
    DELETE_SECTION: {
      actions: assign({
        currentPattern: ({ context, event }) =>
          context.currentPattern.filter(
            (section) => section.id !== event.sectionId,
          ),
        activeSlot: null,
      }),
    },
    UPDATE_SECTION_TIME_SIGNATURE: {
      actions: assign({
        currentPattern: ({ context, event }) =>
          context.currentPattern.map((section) => {
            if (section.id === event.sectionId) {
              const slots = getSlotsForTimeSignature(event.timeSignature);
              const newMeasures = section.measures.map((measure) => ({
                ...measure,
                slots: Array(slots).fill(null), // Reset slots
              }));
              return {
                ...section,
                timeSignature: event.timeSignature,
                measures: newMeasures,
              };
            }
            return section;
          }),
        activeSlot: null,
      }),
    },
    HIGHLIGHT_SLOT: {
      actions: assign({
        activeSlot: ({ event }) => ({
          sectionId: event.sectionId,
          measureId: event.measureId,
          slotIndex: event.slotIndex,
        }),
      }),
    },
    CLEAR_SLOT: {
      actions: [
        assign({
          currentPattern: ({ context, event }) => {
            return context.currentPattern.map((section) => {
              if (section.id === event.sectionId) {
                return {
                  ...section,
                  measures: section.measures.map((measure) => {
                    if (measure.id === event.measureId) {
                      const newSlots = [...measure.slots];
                      newSlots[event.slotIndex] = null;
                      return { ...measure, slots: newSlots };
                    }
                    return measure;
                  }),
                };
              }
              return section;
            });
          },
        }),
      ],
    },
    CLEAR_SLOT_SELECTION: {
      actions: assign({ activeSlot: null }),
    },
    TOGGLE_CHORD_IN_PALETTE: {
      actions: assign({
        chordPalette: ({ context, event }) => {
          const { chordPalette } = context;
          const { chordId } = event;
          if (chordPalette.includes(chordId)) {
            return chordPalette.filter((id) => id !== chordId);
          }
          return [...chordPalette, chordId];
        },
      }),
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
          return selected
            ? safeParsePattern(selected.notes)
            : context.currentPattern;
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
        chordPalette: ({ context, event }) => {
          const selected = context.savedPatterns.find((p) => p.id === event.id);
          if (selected) {
            try {
              const palette = JSON.parse(selected.chord_palette);
              return Array.isArray(palette) ? palette : [];
            } catch (e) {
              return [];
            }
          }
          return context.chordPalette;
        },
        activeSlot: null,
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
    SET_KEY_ROOT: {
      actions: assign({ keyRoot: ({ event }) => event.root }),
    },
    SET_KEY_TYPE: {
      actions: assign({ keyType: ({ event }) => event.keyType }),
    },
    SET_INSTRUMENT: {
      actions: assign({ instrument: ({ event }) => event.instrument }),
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
