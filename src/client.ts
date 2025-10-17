// src/client.ts
import "./index.css";
import { render, html } from "lit-html";
import { createActor, fromPromise } from "xstate";
import { Effect } from "effect"; // <-- FIX: Import Effect directly
import { appMachine } from "./machine";
import * as api from "./api/client";
import * as player from "./audio/player";
import * as selectors from "./state/selectors";

// Import UI Components
import { AppShell } from "./components/AppShell";
import { PatternEditor } from "./components/PatternEditor";
import { VisualEditor } from "./components/VisualEditor";
import { Controls } from "./components/Controls";
import { PatternLoader } from "./components/PatternLoader";
import { ChordBank } from "./components/ChordBank";
import { TuningManager } from "./components/TuningManager";
import { ErrorMessage } from "./components/ErrorMessage";
import { NewPatternDialog } from "./components/NewPatternDialog";

// --- XSTATE & API IMPLEMENTATION ---
const machineWithImplementations = appMachine.provide({
  actors: {
    fetchInitialData: fromPromise(() =>
      // FIX: Use the directly imported Effect
      api.fetchInitialDataEffect.pipe(Effect.runPromise),
    ),
    createPattern: fromPromise(({ input }) =>
      // FIX: Use the directly imported Effect
      api.createPatternEffect(input).pipe(Effect.runPromise),
    ),
    updatePattern: fromPromise(({ input }) =>
      // FIX: Use the directly imported Effect
      api.updatePatternEffect(input).pipe(Effect.runPromise),
    ),
    deletePattern: fromPromise(({ input }) =>
      // FIX: Use the directly imported Effect
      api.deletePatternEffect(input).pipe(Effect.runPromise),
    ),
    createChord: fromPromise(({ input }) =>
      // FIX: Use the directly imported Effect
      api.createChordEffect(input).pipe(Effect.runPromise),
    ),
    updateChord: fromPromise(({ input }) =>
      // FIX: Use the directly imported Effect
      api.updateChordEffect(input).pipe(Effect.runPromise),
    ),
    deleteChord: fromPromise(({ input }) =>
      // FIX: Use the directly imported Effect
      api.deleteChordEffect(input).pipe(Effect.runPromise),
    ),
    createTuning: fromPromise(({ input }) =>
      // FIX: Use the directly imported Effect
      api.createTuningEffect(input).pipe(Effect.runPromise),
    ),
    updateTuning: fromPromise(({ input }) =>
      // FIX: Use the directly imported Effect
      api.updateTuningEffect(input).pipe(Effect.runPromise),
    ),
    deleteTuning: fromPromise(({ input }) =>
      // FIX: Use the directly imported Effect
      api.deleteTuningEffect(input).pipe(Effect.runPromise),
    ),
  },
});

export const appActor = createActor(machineWithImplementations).start();

// --- RENDER & SUBSCRIPTION ---
const getContainer = (id: string) => {
  const el = document.querySelector<HTMLElement>(id);
  if (!el) throw new Error(`Could not find container with id: ${id}`);
  return el;
};

// Initial render of the static shell
render(AppShell(), getContainer("#app-shell"));

// Get all containers for dynamic content
const editorContainer = getContainer("#editor-container");
const controlsContainer = getContainer("#controls-container");
const loaderContainer = getContainer("#loader-container");
const modalContainer = getContainer("#modal-container");
const chordBankContainer = getContainer("#chord-bank-container");
const tuningManagerContainer = getContainer("#tuning-manager-container");
const errorContainer = getContainer("#error-container");

// Initialize the audio player
player.initializePlayer(
  player.parseCode(appActor.getSnapshot().context.currentPattern),
);

// --- MAIN SUBSCRIPTION LOOP ---
let lastScheduledPattern = "";
appActor.subscribe((snapshot) => {
  // --- Render UI Components ---
  const viewMode = selectors.selectViewMode(snapshot);
  render(
    viewMode === "json"
      ? PatternEditor(selectors.selectCurrentPattern(snapshot))
      : VisualEditor(selectors.selectCurrentPattern(snapshot)),
    editorContainer,
  );

  render(
    Controls({
      isAudioOn: selectors.selectIsAudioOn(snapshot),
      isSaving: selectors.selectIsSaving(snapshot),
      patternName: selectors.selectPatternName(snapshot),
      selectedPatternId: selectors.selectSelectedPatternId(snapshot),
      viewMode: viewMode,
    }),
    controlsContainer,
  );

  render(
    PatternLoader(
      selectors.selectSavedPatterns(snapshot),
      selectors.selectSelectedPatternId(snapshot),
    ),
    loaderContainer,
  );

  render(
    ChordBank(
      selectors.selectSavedChords(snapshot),
      selectors.selectSavedTunings(snapshot),
      selectors.selectEditingChordId(snapshot),
    ),
    chordBankContainer,
  );

  render(
    TuningManager(
      selectors.selectSavedTunings(snapshot),
      selectors.selectEditingTuningId(snapshot),
    ),
    tuningManagerContainer,
  );

  render(ErrorMessage(selectors.selectErrorMessage(snapshot)), errorContainer);

  render(
    selectors.selectIsShowDialog(snapshot)
      ? NewPatternDialog(selectors.selectNewPatternName(snapshot))
      : html``,
    modalContainer,
  );

  // --- Audio Side-Effects ---
  player.toggleAudio(selectors.selectIsAudioOn(snapshot));

  const currentPatternString = selectors.selectCurrentPattern(snapshot);
  if (currentPatternString !== lastScheduledPattern) {
    const newNotes = player.parseCode(currentPatternString);
    player.updatePart(newNotes);
    lastScheduledPattern = currentPatternString;
  }
});
