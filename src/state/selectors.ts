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
