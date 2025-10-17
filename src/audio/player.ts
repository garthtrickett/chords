// src/audio/player.ts
import {
  getTransport,
  Synth,
  PolySynth,
  Part,
  start as startAudio,
} from "tone";
import type { NoteEvent } from "../../types/app";

// --- TONE.JS SETUP ---
const synth = new PolySynth(Synth).toDestination();
const transport = getTransport();
let part: Part<NoteEvent & { index: number }>;

// --- UTILITIES ---
export function parseCode(code: string): NoteEvent[] {
  try {
    const parsed = JSON.parse(code);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    // Return empty array for invalid JSON, allowing the app to continue running.
    return [];
  }
}

// --- PLAYER FUNCTIONS ---
export function initializePlayer(initialNotes: NoteEvent[]) {
  part = new Part<NoteEvent & { index: number }>((time, value) => {
    // Schedule the note to be played by the synth
    synth.triggerAttackRelease(value.note, value.duration, time);

    // Visual feedback: highlight the currently playing note element
    const el = document.getElementById(`note-${value.index}`);
    if (el) {
      el.classList.add("highlight");
      // Remove the highlight after a short delay
      setTimeout(() => {
        el.classList.remove("highlight");
      }, 150);
    }
  }, []).start(0);

  part.loop = true;
  part.loopEnd = "64m"; // Set a long loop duration

  updatePart(initialNotes);
}

export function updatePart(notes: NoteEvent[]) {
  if (!part) return;
  part.clear();
  const indexedNotes = notes.map((note, index) => ({ ...note, index }));
  indexedNotes.forEach((noteEvent) => {
    part.add(noteEvent);
  });
}

export function toggleAudio(isOn: boolean) {
  if (isOn) {
    if (transport.state !== "started") {
      startAudio().then(() => transport.start());
    }
  } else {
    if (transport.state !== "stopped") {
      transport.stop();
    }
  }
}

// --- DYNAMIC STYLES for highlighting notes ---
const style = document.createElement("style");
style.textContent = `
  .highlight {
    background-color: rgba(20, 184, 166, 0.3); /* Corresponds to Tailwind's bg-teal-400/30 */
    border-color: rgb(20 184, 166); /* Corresponds to Tailwind's border-teal-400 */
  }
`;
document.head.appendChild(style);
