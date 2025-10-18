// src/client.ts
import "./index.css";
import { render, html } from "lit-html";
import { createActor, fromPromise, type Actor } from "xstate"; // Import Actor type
import { Effect } from "effect";
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
      api.fetchInitialDataEffect.pipe(Effect.runPromise),
    ),
    createPattern: fromPromise(({ input }) =>
      api.createPatternEffect(input).pipe(Effect.runPromise),
    ),
    updatePattern: fromPromise(({ input }) =>
      api.updatePatternEffect(input).pipe(Effect.runPromise),
    ),
    deletePattern: fromPromise(({ input }) =>
      api.deletePatternEffect(input).pipe(Effect.runPromise),
    ),
    createChord: fromPromise(({ input }) =>
      api.createChordEffect(input).pipe(Effect.runPromise),
    ),
    updateChord: fromPromise(({ input }) =>
      api.updateChordEffect(input).pipe(Effect.runPromise),
    ),
    deleteChord: fromPromise(({ input }) =>
      api.deleteChordEffect(input).pipe(Effect.runPromise),
    ),
    createTuning: fromPromise(({ input }) =>
      api.createTuningEffect(input).pipe(Effect.runPromise),
    ),
    updateTuning: fromPromise(({ input }) =>
      api.updateTuningEffect(input).pipe(Effect.runPromise),
    ),
    deleteTuning: fromPromise(({ input }) =>
      api.deleteTuningEffect(input).pipe(Effect.runPromise),
    ),
  },
});

// --- RENDER & HMR LOGIC ---
let appActor: Actor<typeof machineWithImplementations>;
let lastScheduledPattern = "";

const getContainer = (id: string) => {
  const el = document.querySelector<HTMLElement>(id);
  if (!el) throw new Error(`Could not find container with id: ${id}`);
  return el;
};

// Encapsulate the rendering logic into a function
const runApplication = () => {
  // Get all containers for dynamic content
  const editorContainer = getContainer("#editor-container");
  const controlsContainer = getContainer("#controls-container");
  const loaderContainer = getContainer("#loader-container");
  const modalContainer = getContainer("#modal-container");
  const chordBankContainer = getContainer("#chord-bank-container");
  const tuningManagerContainer = getContainer("#tuning-manager-container");
  const errorContainer = getContainer("#error-container");

  // Create and start the actor
  appActor = createActor(machineWithImplementations).start();

  // Initialize the audio player
  player.initializePlayer(
    player.parseCode(appActor.getSnapshot().context.currentPattern),
  );

  // --- MAIN SUBSCRIPTION LOOP ---
  appActor.subscribe((snapshot) => {
    const selectedPatternId = selectors.selectSelectedPatternId(snapshot);

    // --- Render UI Components ---
    if (selectedPatternId) {
      const viewMode = selectors.selectViewMode(snapshot);
      render(
        viewMode === "json"
          ? PatternEditor(selectors.selectCurrentPattern(snapshot))
          : VisualEditor(
            selectors.selectCurrentPattern(snapshot),
            selectors.selectNotesInCurrentKey(snapshot),
          ),
        editorContainer,
      );
    } else {
      render(
        html`<div
          class="min-h-[240px] flex items-center justify-center text-center text-zinc-500"
        >
          <div>
            <p class="font-medium text-zinc-400">No pattern loaded.</p>
            <p class="text-sm">Create a new pattern to get started.</p>
          </div>
        </div>`,
        editorContainer,
      );
    }

    render(
      Controls({
        isAudioOn: selectors.selectIsAudioOn(snapshot),
        isSaving: selectors.selectIsSaving(snapshot),
        patternName: selectors.selectPatternName(snapshot),
        selectedPatternId: selectors.selectSelectedPatternId(snapshot),
        viewMode: selectors.selectViewMode(snapshot),
        keyRoot: selectors.selectKeyRoot(snapshot),
        keyType: selectors.selectKeyType(snapshot),
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
        selectors.selectKeyRoot(snapshot),
        selectors.selectKeyType(snapshot),
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
};

// --- INITIAL BOOTSTRAP ---
render(AppShell(), getContainer("#app-shell"));
runApplication();

// --- VITE HMR ---
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // When a hot update is accepted, stop the old actor and re-run the application
    // to create a new one with the updated code.
    if (appActor) {
      appActor.stop();
    }
    runApplication();
  });
}

// Export the actor so it can be used in other files if needed
export { appActor };


