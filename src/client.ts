// src/client.ts
import * as Tone from "tone";
import { treaty } from "@elysiajs/eden";
import type { App } from "./server";
import type { SerializableChord } from "../types/database"; // <-- MODIFIED: Import SerializableChord

// --- 1. SETUP & DOM ELEMENTS ---
const editorTextarea =
  document.querySelector<HTMLTextAreaElement>("#editorTextarea");
const startButton = document.querySelector<HTMLButtonElement>("#startButton");
const saveButton = document.querySelector<HTMLButtonElement>("#saveButton");
const chordNameInput =
  document.querySelector<HTMLInputElement>("#chordNameInput");
const loadSelect = document.querySelector<HTMLSelectElement>("#loadSelect");

if (
  !editorTextarea ||
  !startButton ||
  !saveButton ||
  !chordNameInput ||
  !loadSelect
) {
  throw new Error("Could not find required HTML elements");
}

// --- 2. INITIALIZE CLIENT & AUDIO ENGINE ---
const client = treaty<App>("http://localhost:8080");
const synth = new Tone.Synth().toDestination();
let sequence = new Tone.Sequence().start(0);
let savedChords: SerializableChord[] = []; // <-- MODIFIED: Use SerializableChord type

// --- 3. PARSING LOGIC ---
function parseCode(code: string): string[] {
  return code.trim().split(/\s+/).filter(Boolean);
}

// --- 4. EDITOR LOGIC ---
editorTextarea.addEventListener("input", () => {
  const code = editorTextarea.value;
  const notes = parseCode(code);
  sequence.events = notes;
});

// --- 5. API & UI LOGIC ---

async function fetchAndPopulateChords() {
  const { data: chords, error } = await client.chords.get();
  if (error) {
    console.error("Failed to load chords:", error);
    return;
  }

  // The 'data' from Eden will be plain objects, matching our SerializableChord type.
  savedChords = chords || [];

  if (loadSelect) {
    loadSelect.innerHTML = '<option value="">Load a saved pattern...</option>';
    for (const chord of savedChords) {
      if (chord.id) {
        // <-- MODIFIED: Add null check for id
        const option = document.createElement("option");
        option.value = chord.id;
        option.textContent = chord.name;
        loadSelect.appendChild(option);
      }
    }
  }
}

saveButton.addEventListener("click", async () => {
  if (!chordNameInput) return;
  const patternName = chordNameInput.value.trim();
  const patternContent = editorTextarea.value;

  if (!patternName) {
    alert("Please enter a name for the pattern.");
    return;
  }

  const nameWithContent = `${patternName}: ${patternContent}`;
  const { error } = await client.chords.post({ name: nameWithContent });

  if (error) {
    console.error("Failed to save chord pattern:", error);
    alert("Failed to save pattern.");
  } else {
    console.log("Pattern saved successfully!");
    alert("Pattern saved!");
    await fetchAndPopulateChords();
  }
});

loadSelect.addEventListener("change", () => {
  const selectedId = loadSelect.value;
  const selectedChord = savedChords.find((c) => c.id === selectedId);

  if (selectedChord && chordNameInput) {
    const patternContent = selectedChord.name.split(": ")[1] || "";
    chordNameInput.value = selectedChord.name.split(": ")[0] || "";

    editorTextarea.value = patternContent;
    editorTextarea.dispatchEvent(new Event("input"));
  }
});

// --- 6. AUDIO START & INITIALIZATION ---
startButton.addEventListener("click", async () => {
  await Tone.start();
  Tone.Transport.start();
  console.log("Audio context started.");

  startButton.style.display = "none";
  if (saveButton) saveButton.disabled = false;

  const initialNotes = parseCode(editorTextarea.value);
  sequence = new Tone.Sequence(
    (time, note) => {
      synth.triggerAttackRelease(note, "8n", time);
    },
    initialNotes,
    "4n",
  ).start(0);

  await fetchAndPopulateChords();
});
