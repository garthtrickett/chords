// src/audio/player.ts
import {
  getTransport,
  start as startAudio,
  Sampler,
  Time,
} from "tone";
import type { NoteEvent, PatternSection } from "../../types/app";

// --- TONE.JS SETUP ---
const pianoSampler = new Sampler({
  urls: {
    C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", A4: "A4.mp3",
  },
  release: 1,
  baseUrl: "https://tonejs.github.io/audio/salamander/",
}).toDestination();

const guitarSampler = new Sampler({
  urls: {
    E2: "guitar_LowEstring1.mp3", A2: "guitar_Astring.mp3", D3: "guitar_Dstring.mp3",
    G3: "guitar_Gstring.mp3", B3: "guitar_Bstring.mp3", E4: "guitar_highEstring.mp3",
  },
  release: 1,
  baseUrl: "https://tonejs.github.io/audio/berklee/",
}).toDestination();

let activeSynth: Sampler = pianoSampler; // Default to piano
const transport = getTransport();
let scheduledEventIds: number[] = [];

// --- UTILITIES ---
export function parseCode(code: string | PatternSection[]): PatternSection[] {
  if (Array.isArray(code)) return code; // Already in the correct format
  try {
    const parsed = JSON.parse(code);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
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

export function initializePlayer() {
  transport.loop = true;
  transport.loopStart = 0;
  transport.loopEnd = "1m";
}

export function updateTransportSchedule(pattern: PatternSection[]) {
  // Clear previous events
  scheduledEventIds.forEach((id) => transport.clear(id));
  scheduledEventIds = [];

  let accumulatedTime = 0; // Use seconds for absolute timing

  pattern.forEach((section) => {
    // Temporarily set time signature to calculate measure duration accurately
    const [beats, beatType] = section.timeSignature.split("/").map(Number);
    transport.timeSignature = [beats, beatType];
    const measureDuration = Time("1m").toSeconds();

    section.measures.forEach((measure) => {
      measure.notes.forEach((note) => {
        const eventId = transport.schedule((time) => {
          if (activeSynth.loaded) {
            activeSynth.triggerAttackRelease(note.note, note.duration, time);
          }
        }, accumulatedTime + Time(note.time).toSeconds());
        scheduledEventIds.push(eventId);
      });
      // Increment total time by the calculated duration of one measure
      accumulatedTime += measureDuration;
    });
  });

  if (pattern.length > 0 && accumulatedTime > 0) {
    transport.loopEnd = accumulatedTime;
    // Reset time signature to the first section for consistent default timing
    const [beats, beatType] = pattern[0].timeSignature.split("/").map(Number);
    transport.timeSignature = [beats, beatType];
  } else {
    transport.loopEnd = "1m"; // Default loop if empty
  }
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
