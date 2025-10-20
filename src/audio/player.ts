// src/audio/player.ts
import {
  getTransport,
  start as startAudio,
  Sampler,
  Time,
  Synth,
} from "tone";
import type {
  PatternSection,
  SerializableChord,
  SerializableTuning,
} from "../../types/app";
import { type AnyActorRef } from "xstate";
type AppSend = AnyActorRef["send"];

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
const melodySynth = new Synth().toDestination();
let activeSynth: Sampler = pianoSampler;
const transport = getTransport();
let scheduledEventIds: number[] = [];
let totalSlots = 0;
let sendToMachine: AppSend | null = null;
let beatCursorId: number | null = null;

// --- UTILITIES ---
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_MAP: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6,
  Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
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

export function setBpm(newBpm: number) {
  transport.bpm.value = newBpm;
}

export function initializePlayer(send: AppSend) {
  sendToMachine = send;
  transport.loop = true;
  transport.loopStart = 0;
  transport.loopEnd = "1m";
  transport.bpm.value = 120;
}

function scheduleBeatCursor(totalDuration: number) {
  if (!sendToMachine || totalDuration === 0) return;
  if (beatCursorId !== null) {
    transport.clear(beatCursorId);
    beatCursorId = null;
  }
  const sixteenthNoteDuration = Time("16n").toSeconds();
  const cursor = transport.scheduleRepeat(
    () => {
      const currentBeat = Math.floor(
        (transport.seconds / sixteenthNoteDuration) % totalSlots,
      );
      if (sendToMachine) {
        sendToMachine({ type: "UPDATE_ACTIVE_BEAT", beat: currentBeat });
      }
    },
    "16n",
    0,
  );
  beatCursorId = cursor;
}

export function updateTransportSchedule(
  pattern: PatternSection[],
  chords: SerializableChord[],
  tunings: SerializableTuning[],
) {
  // FIX: Stop transport and cancel all events to ensure a clean slate.
  const wasPlaying = transport.state === "started";
  transport.stop();
  transport.cancel(0);

  // Reset internal tracking state
  scheduledEventIds = [];
  totalSlots = 0;
  let totalDuration = 0;

  // Prepare data maps
  const chordsMap = new Map(chords.map((c) => [c.id, c]));
  const tuningsMap = new Map(tunings.map((t) => [t.name, t.notes.split(" ")]));
  const sixteenthNoteDuration = Time("16n").toSeconds();
  const flatChordEventList: { time: number; notes: string[] }[] = [];
  const localEventIds: number[] = [];

  // Recalculate duration, slots, and collect events for the new pattern
  pattern.forEach((section) => {
    const [beats, beatType] = section.timeSignature.split("/").map(Number);
    const subdivisionsPerBeat = beatType === 8 ? 2 : 4;
    const slotsPerMeasure = beats * subdivisionsPerBeat;
    const measureDuration = slotsPerMeasure * sixteenthNoteDuration;
    const sectionStartTime = totalDuration;

    section.measures.forEach((measure) => {
      measure.slots.forEach((chordId, slotIndex) => {
        if (!chordId) return;
        const chord = chordsMap.get(chordId);
        if (!chord) return;
        const tuningNotes = tuningsMap.get(chord.tuning);
        if (!tuningNotes) return;
        const notesToPlay = calculateChordNotes(chord.tab, tuningNotes);
        const eventTime = totalDuration + slotIndex * sixteenthNoteDuration;
        flatChordEventList.push({ time: eventTime, notes: notesToPlay });
      });
      totalDuration += measureDuration;
      totalSlots += slotsPerMeasure;
    });

    (section.melody || []).forEach((noteEvent) => {
      const startTime =
        sectionStartTime + noteEvent.time * sixteenthNoteDuration;
      const duration = noteEvent.duration * sixteenthNoteDuration;
      const eventId = transport.schedule((time) => {
        melodySynth.triggerAttackRelease(noteEvent.note, duration, time);
      }, startTime);
      localEventIds.push(eventId);
    });
  });

  // Schedule collected chord events
  if (flatChordEventList.length > 0) {
    flatChordEventList.forEach((event, index) => {
      const isLastEvent = index === flatChordEventList.length - 1;
      const duration = isLastEvent
        ? totalDuration - event.time
        : flatChordEventList[index + 1].time - event.time;
      const eventId = transport.schedule((time) => {
        if (activeSynth.loaded) {
          activeSynth.triggerAttackRelease(
            event.notes.map((n) => `${n}4`),
            duration,
            time,
          );
        }
      }, event.time);
      localEventIds.push(eventId);
    });
  }

  // FIX: Always set the loopEnd based on the calculated duration.
  if (totalDuration > 0) {
    transport.loopEnd = totalDuration;
  } else {
    transport.loopEnd = "1m"; // Default for empty pattern
    totalSlots = 1; // Prevent division by zero
  }

  scheduledEventIds = localEventIds;
  scheduleBeatCursor(totalDuration);

  // FIX: Rewind and reset beat counter after loading a new pattern
  transport.position = 0;
  if (sendToMachine) {
    sendToMachine({ type: "UPDATE_ACTIVE_BEAT", beat: -1 });
  }

  // If the transport was playing before, start it again from the beginning.
  if (wasPlaying) {
    transport.start();
  }
}

export async function togglePlayback() {
  if (transport.state === "stopped" || transport.state === "paused") {
    await startAudio();
    transport.start(undefined, transport.position);
  } else {
    if (sendToMachine) {
      sendToMachine({
        type: "UPDATE_ACTIVE_BEAT",
        beat: Math.floor(
          (transport.seconds / Time("16n").toSeconds()) % totalSlots,
        ),
      });
    }
    transport.pause();
  }
}

export function stopAndRewind() {
  transport.stop();
  transport.position = 0;
  if (sendToMachine) {
    sendToMachine({ type: "UPDATE_ACTIVE_BEAT", beat: -1 });
  }
}
