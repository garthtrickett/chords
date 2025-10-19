// src/audio/player.ts
import {
  getTransport,
  Part,
  start as startAudio,
  Sampler,
} from "tone";
import type { NoteEvent } from "../../types/app";

// --- TONE.JS SETUP ---
const pianoSampler = new Sampler({
  urls: {
    C4: "C4.mp3",
    "D#4": "Ds4.mp3",
    "F#4": "Fs4.mp3",
    A4: "A4.mp3",
  },
  release: 1,
  baseUrl: "https://tonejs.github.io/audio/salamander/",
}).toDestination();

const guitarSampler = new Sampler({
  urls: {
    E2: "guitar_LowEstring1.mp3",
    A2: "guitar_Astring.mp3",
    D3: "guitar_Dstring.mp3",
    G3: "guitar_Gstring.mp3",
    B3: "guitar_Bstring.mp3",
    E4: "guitar_highEstring.mp3",
  },
  release: 1,
  baseUrl: "https://tonejs.github.io/audio/berklee/",
}).toDestination();

let activeSynth: Sampler = pianoSampler; // Default to piano
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
export function setInstrument(instrument: "piano" | "guitar") {
  if (instrument === "piano") {
    activeSynth = pianoSampler;
  } else {
    activeSynth = guitarSampler;
  }
}

export function initializePlayer(initialNotes: NoteEvent[]) {
  part = new Part<NoteEvent & { index: number }>((time, value) => {
    // Schedule the note to be played by the synth
    if (activeSynth.loaded) {
      activeSynth.triggerAttackRelease(value.note, value.duration, time);
    }

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
