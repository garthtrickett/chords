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
  clipboardChordId: string | null;
  // NEW: Track the currently playing 16th note slot index
  activeBeat: number;
  bpm: number;
}

// 2. EVENTS
export type AppEvent =
  | { type: "TOGGLE_PLAYBACK" } // MODIFIED: New general play/pause event
  | { type: "STOP_AND_REWIND" } // NEW: Event to stop and set position to 0
  | { type: "UPDATE_PATTERN_STRUCTURE"; value: PatternSection[] }
  | { type: "ADD_SECTION" }
  | {
    type: "ADD_MEASURE";
    sectionId: string;
  }
  | {
    type: "UPDATE_SECTION_TIME_SIGNATURE";
    sectionId: string;
    timeSignature: string;
  }
  | {
    type: "DELETE_SECTION";
    sectionId: string;
  }
  | { type: "DUPLICATE_SECTION"; sectionId: string } // <-- NEW EVENT
  | {
    type: "SELECT_SLOT";
    sectionId: string;
    measureId: string;
    slotIndex: number;
  }
  | {
    type: "HIGHLIGHT_SLOT";
    sectionId: string;
    measureId: string;
    slotIndex: number;
  }
  | {
    type: "CLEAR_SLOT";
    sectionId: string;
    measureId: string;
    slotIndex: number;
  }
  | { type: "CLEAR_SLOT_SELECTION" }
  | { type: "TOGGLE_CHORD_IN_PALETTE"; chordId: string }
  | {
    type: "ASSIGN_CHORD_TO_SLOT";
    chordId: string;
  }
  | { type: "CANCEL_CHORD_SELECTION" }
  | { type: "UPDATE_PATTERN_NAME"; value: string }
  | { type: "SELECT_PATTERN"; id: string }
  | { type: "NEW_PATTERN" }
  | { type: "CANCEL_NEW_PATTERN" }
  | { type: "UPDATE_NEW_PATTERN_NAME"; value: string }
  | { type: "CREATE_PATTERN"; name: string }
  | { type: "COPY_SLOT" }
  | { type: "PASTE_SLOT" }
  | {
    type: "MOVE_CHORD";
    source: { sectionId: string; measureId: string; slotIndex: number };
    target: { sectionId: string; measureId: string; slotIndex: number };
  }
  | {
    type: "MOVE_SECTION"; // <-- NEW EVENT
    sourceId: string;
    targetId: string;
  }
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
  | {
    type: "CREATE_CHORD";
    input: {
      name: string;
      tab: string;
      tuning: string;
    };
  }
  | { type: "EDIT_CHORD"; id: string }
  | { type: "CANCEL_EDIT_CHORD" }
  | {
    type: "UPDATE_CHORD";
    input: { id: string; name: string; tab: string; tuning: string };
  }
  | { type: "DELETE_CHORD"; id: string }
  | {
    type: "CREATE_TUNING";
    input: {
      name: string;
      notes: string;
    };
  }
  | {
    type: "UPDATE_TUNING";
    input: {
      id: string;
      name: string;
      notes: string;
    };
  }
  | { type: "DELETE_TUNING"; id: string }
  | {
    type: "EDIT_TUNING";
    id: string;
  }
  | { type: "CANCEL_EDIT_TUNING" }
  | { type: "SET_KEY_ROOT"; root: string }
  | { type: "SET_KEY_TYPE"; keyType: "major" | "minor" }
  | { type: "SET_INSTRUMENT"; instrument: "piano" | "guitar" }
  | { type: "SET_BPM"; value: number }
  | { type: "SET_CHORD_BANK_FILTER"; key: string }
  | { type: "SET_CHORD_BANK_FILTER_TUNING"; tuning: string }
  | { type: "CLEAR_CHORD_BANK_FILTERS" }
  | {
    type: "UPDATE_ACTIVE_BEAT"; // <-- NEW EVENT
    beat: number;
  }
  | {
    type: "done.invoke.fetchInitialData";
    output: {
      patterns: SerializablePattern[];
      chords: SerializableChord[];
      tunings: SerializableTuning[];
    };
  }
  | {
    type: "error.platform.fetchInitialData";
    error: unknown;
  }
  | { type: "done.invoke.updatePattern" }
  | { type: "error.platform.updatePattern"; error: unknown }
  | { type: "done.invoke.createPattern"; output: SerializablePattern }
  | { type: "error.platform.createPattern"; error: unknown }
  | { type: "done.invoke.deletePattern" }
  | { type: "error.platform.deletePattern"; error: unknown }
  | {
    type: "done.invoke.createChord";
    output: SerializableChord;
  }
  | { type: "error.platform.createChord"; error: unknown }
  | { type: "done.invoke.updateChord" }
  | { type: "error.platform.updateChord"; error: unknown }
  | { type: "done.invoke.deleteChord" }
  | {
    type: "error.platform.deleteChord";
    error: unknown;
  }
  | { type: "done.invoke.createTuning"; output: SerializableTuning }
  | {
    type: "error.platform.createTuning";
    error: unknown;
  }
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
        (parsed[0] &&
          parsed[0].id &&
          parsed[0].timeSignature &&
          parsed[0].measures)
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
    return beats * 2;
    // Each 8th note gets two 16th note slots
  }
  return beats * 4;
  // Each 4th note gets four 16th note slots
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
      {
        name: string;
        notes: string;
        key_root: string;
        key_type: string;
        chord_palette: string;
      }
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
      {
        id: string;
        name: string;
        tab: string;
        tuning: string;
      }
    >,
    deleteChord: {} as PromiseActorLogic<void, { id: string }>,
    createTuning: {} as PromiseActorLogic<
      SerializableTuning,
      {
        name: string;
        notes: string;
      }
    >,
    updateTuning: {} as PromiseActorLogic<
      void,
      {
        id: string;
        name: string;
        notes: string;
      }
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
    clipboardChordId: null,
    activeBeat: -1,
    bpm: 120,
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
                // MODIFIED: 'off' state entry action is removed to keep 'activeBeat' value
                off: {
                  on: {
                    TOGGLE_PLAYBACK: "on",
                    // Only reset activeBeat when STOP_AND_REWIND is called
                    STOP_AND_REWIND: {
                      target: "off",
                      actions: assign({ activeBeat: -1 }),
                    },
                  },
                  // Note: No entry action means activeBeat is preserved when moving from 'on' to 'off'
                },
                on: {
                  on: {
                    TOGGLE_PLAYBACK: "off", // Pauses, moves to 'off' state, preserving beat
                    STOP_AND_REWIND: {
                      target: "off", // Moves to 'off' state, explicitly resets beat
                      actions: assign({ activeBeat: -1 }),
                    },
                  },
                },
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
    // NEW: Update active beat from the audio player
    UPDATE_ACTIVE_BEAT: {
      actions: assign({ activeBeat: ({ event }) => event.beat }),
    },
    SET_BPM: {
      actions: assign({ bpm: ({ event }) => event.value }),
    },
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
    DUPLICATE_SECTION: {
      // <-- NEW ACTION

      actions: assign({
        currentPattern: ({ context, event }) => {
          const sectionToDuplicate = context.currentPattern.find(
            (s) => s.id === event.sectionId,
          );
          if (!sectionToDuplicate) return context.currentPattern;

          // Deep copy the section to ensure slots/measures are new objects

          let newSection: PatternSection = JSON.parse(
            JSON.stringify(sectionToDuplicate),
          );

          // 1. Assign a new ID to the section
          newSection.id = nanoid();

          // 2. Assign new IDs to all measures within the section
          newSection.measures = newSection.measures.map(
            (measure: Measure) => ({
              ...measure,
              id: nanoid(),
            }),
          );
          // Find the index of the original section
          const originalIndex = context.currentPattern.findIndex(
            (s) => s.id === event.sectionId,
          );
          // Insert the duplicated section right after the original
          const newPattern = [...context.currentPattern];
          newPattern.splice(originalIndex + 1, 0, newSection);
          return newPattern;
        },
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
    MOVE_SECTION: {
      // <-- NEW ACTION
      actions: assign({
        currentPattern: ({ context, event }) => {
          const { currentPattern } = context;
          const { sourceId, targetId } = event;

          const sourceIndex = currentPattern.findIndex((s) => s.id === sourceId);
          const targetIndex = currentPattern.findIndex((s) => s.id === targetId);

          if (sourceIndex === -1 || targetIndex === -1) {
            return currentPattern;
          }

          const newPattern = [...currentPattern];
          const [movedSection] = newPattern.splice(sourceIndex, 1);
          newPattern.splice(targetIndex, 0, movedSection);

          return newPattern;
        },
        activeSlot: null,
      }),
    },
    MOVE_CHORD: {
      actions: assign({
        currentPattern: ({ context, event }) => {
          const { source, target } = event;
          const { currentPattern } = context;
          const sourceSection = currentPattern.find(
            (s) => s.id === source.sectionId,
          );
          if (!sourceSection) return currentPattern;
          const sourceMeasure = sourceSection.measures.find(
            (m) => m.id === source.measureId,
          );
          if (!sourceMeasure) return currentPattern;
          const chordIdToMove = sourceMeasure.slots[source.slotIndex];

          if (chordIdToMove === null || chordIdToMove === undefined)
            return currentPattern;
          const newPattern = JSON.parse(JSON.stringify(currentPattern));

          const newSourceSection = newPattern.find(
            (s: PatternSection) => s.id === source.sectionId,
          );
          const newSourceMeasure = newSourceSection.measures.find(
            (m: Measure) => m.id === source.measureId,
          );
          newSourceMeasure.slots[source.slotIndex] = null;

          const newTargetSection = newPattern.find(
            (s: PatternSection) => s.id === target.sectionId,
          );
          const newTargetMeasure = newTargetSection.measures.find(
            (m: Measure) => m.id === target.measureId,
          );
          newTargetMeasure.slots[target.slotIndex] = chordIdToMove;

          return newPattern;
        },
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
    COPY_SLOT: {
      actions: assign({
        clipboardChordId: ({ context }) => {
          const { activeSlot, currentPattern } = context;
          if (!activeSlot) return context.clipboardChordId;

          const section = currentPattern.find(
            (s) => s.id === activeSlot.sectionId,
          );
          if (!section) return context.clipboardChordId;

          const measure = section.measures.find(
            (m) => m.id === activeSlot.measureId,
          );
          if (!measure) return context.clipboardChordId;

          return measure.slots[activeSlot.slotIndex] ?? null;
        },
      }),
    },
    PASTE_SLOT: {
      actions: assign({
        currentPattern: ({ context }) => {
          const { activeSlot, currentPattern, clipboardChordId } = context;
          if (!activeSlot || clipboardChordId === null) {
            return currentPattern;
          }

          return currentPattern.map((section) => {
            if (section.id === activeSlot.sectionId) {
              return {
                ...section,
                measures: section.measures.map((measure) => {
                  if (measure.id === activeSlot.measureId) {
                    const newSlots = [...measure.slots];
                    newSlots[activeSlot.slotIndex] = clipboardChordId;
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
      actions: assign({
        chordBankFilterKey: null,
        chordBankFilterTuning: null,
      }),
    },
  },
});
