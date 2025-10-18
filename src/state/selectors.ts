// src/state/selectors.ts
import { type SnapshotFrom } from "xstate";
import { appMachine } from "../machine";
export type AppSnapshot = SnapshotFrom<typeof appMachine>;

export const selectIsAudioOn = (s: AppSnapshot) =>
  s.matches({ running: { editing: { audio: "on" } } });
export const selectIsSaving = (s: AppSnapshot) =>
  !s.matches({ running: { editing: { saveStatus: "idle" } } });
export const selectCurrentPattern = (s: AppSnapshot) => s.context.currentPattern;
export const selectPatternName = (s: AppSnapshot) => s.context.patternName;
export const selectSavedPatterns = (s: AppSnapshot) => s.context.savedPatterns;
export const selectSavedChords = (s: AppSnapshot) => s.context.savedChords;
export const selectSavedTunings = (s: AppSnapshot) => s.context.savedTunings;
export const selectEditingChordId = (s: AppSnapshot) => s.context.editingChordId;
export const selectEditingTuningId = (s: AppSnapshot) =>
  s.context.editingTuningId;
export const selectErrorMessage = (s: AppSnapshot) => s.context.errorMessage;
export const selectSelectedPatternId = (s: AppSnapshot) =>
  s.context.selectedPatternId;
export const selectIsShowDialog = (s: AppSnapshot) =>
  s.matches({ running: "showingNewPatternDialog" });
export const selectNewPatternName = (s: AppSnapshot) => s.context.newPatternName;
export const selectViewMode = (s: AppSnapshot) =>
  s.matches({ running: { editing: { viewMode: "visual" } } })
    ? "visual"
    : "json";

// NEW: Selectors for the musical key context
export const selectKeyRoot = (s: AppSnapshot) => s.context.keyRoot;
export const selectKeyType = (s: AppSnapshot) => s.context.keyType;
export const selectChordBankFilterKey = (s: AppSnapshot) =>
  s.context.chordBankFilterKey;
export const selectChordBankFilterTuning = (s: AppSnapshot) =>
  s.context.chordBankFilterTuning;

// --- Music Theory Logic ---
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]; // W, W, H, W, W, W, H
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // W, H, W, W, H, W, W

export const selectNotesInCurrentKey = (s: AppSnapshot): string[] => {
  const { keyRoot, keyType } = s.context;
  const rootIndex = NOTES.indexOf(keyRoot);
  if (rootIndex === -1) return [];

  const intervals = keyType === "major" ? MAJOR_INTERVALS : MINOR_INTERVALS;
  return intervals.map((interval) => {
    const noteIndex = (rootIndex + interval) % 12;
    return NOTES[noteIndex];
  });
};
