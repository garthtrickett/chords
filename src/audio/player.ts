// src/audio/player.ts
import { getTransport, start as startAudio, Sampler, Time } from "tone";
import type {
  PatternSection,
  SerializableChord,
  SerializableTuning,
} from "../../types/app";

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

let activeSynth: Sampler = pianoSampler;
const transport = getTransport();
let scheduledEventIds: number[] = [];

// --- UTILITIES ---
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_MAP: Record<string, number> = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6,
  "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
};

function calculateChordNotes(tab: string, tuningNotes: string[]): string[] {
  const notes: string[] = [];
  for (let i = 0; i < 6; i++) {
    const fret = tab[i];
    if (fret === "x" || fret === "X" || fret === undefined) continue;
    const fretNum = parseInt(fret, 10);
    if (isNaN(fretNum)) continue;
    const openStringNote = tuningNotes[i]?.toUpperCase();
    if (!openStringNote || NOTE_MAP[openStringNote] === undefined) continue;
    const openNoteIndex = NOTE_MAP[openStringNote];
    const finalNoteIndex = (openNoteIndex + fretNum) % 12;
    notes.push(NOTES[finalNoteIndex]);
  }
  return notes;
}

// --- PLAYER FUNCTIONS ---
export function setInstrument(instrument: "piano" | "guitar") {
  activeSynth = instrument === "piano" ? pianoSampler : guitarSampler;
}

export function initializePlayer() {
  transport.loop = true;
  transport.loopStart = 0;
  transport.loopEnd = "1m";
}

export function updateTransportSchedule(
  pattern: PatternSection[],
  chords: SerializableChord[],
  tunings: SerializableTuning[],
) {
  scheduledEventIds.forEach((id) => transport.clear(id));
  scheduledEventIds = [];

  const chordsMap = new Map(chords.map((c) => [c.id, c]));
  const tuningsMap = new Map(tunings.map((t) => [t.name, t.notes.split(" ")]));

  let totalDuration = 0;
  const flatEventList: { time: number; notes: string[] }[] = [];

  pattern.forEach((section) => {
    const [beats, beatType] = section.timeSignature.split("/").map(Number);
    const sixteenthNoteDuration = Time("16n").toSeconds();
    const measureDuration = beats * (beatType === 8 ? 2 : 4) * sixteenthNoteDuration;

    section.measures.forEach((measure) => {
      measure.slots.forEach((chordId, slotIndex) => {
        if (!chordId) return;

        const chord = chordsMap.get(chordId);
        if (!chord) return;

        const tuningNotes = tuningsMap.get(chord.tuning);
        if (!tuningNotes) return;

        const notesToPlay = calculateChordNotes(chord.tab, tuningNotes);
        const eventTime = totalDuration + slotIndex * sixteenthNoteDuration;

        flatEventList.push({ time: eventTime, notes: notesToPlay });
      });
      totalDuration += measureDuration;
    });
  });

  if (flatEventList.length > 0) {
    flatEventList.forEach((event, index) => {
      const isLastEvent = index === flatEventList.length - 1;
      const duration = isLastEvent
        ? totalDuration - event.time
        : flatEventList[index + 1].time - event.time;

      const eventId = transport.schedule((time) => {
        if (activeSynth.loaded) {
          activeSynth.triggerAttackRelease(
            event.notes.map((n) => `${n}4`),
            duration,
            time,
          );
        }
      }, event.time);
      scheduledEventIds.push(eventId);
    });
    transport.loopEnd = totalDuration;
  } else {
    transport.loopEnd = "1m";
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
