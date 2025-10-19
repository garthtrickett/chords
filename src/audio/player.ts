// src/audio/player.ts
import { getTransport, start as startAudio, Sampler, Time } from "tone";
import type {
  PatternSection,
  SerializableChord,
  SerializableTuning,
} from "../../types/app";
// FIX: Import the necessary types from xstate and extract the Send type.
import { type AnyActorRef } from "xstate";
type AppSend = AnyActorRef["send"]; // Extract the function type from AnyActorRef

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
let totalSlots = 0;
let sendToMachine: AppSend | null = null;
let beatCursorId: number | null = null; // NEW: Track the beat cursor ID separately

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
  activeSynth = instrument === "piano" ?
    pianoSampler : guitarSampler;
}

// MODIFIED: Use the imported AppSend type
export function initializePlayer(send: AppSend) {
  sendToMachine = send;
  transport.loop = true;
  transport.loopStart = 0;
  transport.loopEnd = "1m";
}

function scheduleBeatCursor(totalDuration: number) {
  if (!sendToMachine || totalDuration === 0) return;

  // Clear previous cursor if it exists
  if (beatCursorId !== null) {
    transport.clear(beatCursorId);
    beatCursorId = null;
  }

  const sixteenthNoteDuration = Time("16n").toSeconds();

  // Use Tone.js loop to schedule beat updates
  const cursor = transport.scheduleRepeat((time: number) => {
    // We use Tone.js's transport time to calculate the current beat index
    const currentBeat = Math.floor((transport.seconds / sixteenthNoteDuration) % totalSlots);

    if (sendToMachine) {
      sendToMachine({ type: "UPDATE_ACTIVE_BEAT", beat: currentBeat });
    }
  }, "16n", 0);

  // Store the new cursor ID
  beatCursorId = cursor;
}


export function updateTransportSchedule(
  pattern: PatternSection[],
  chords: SerializableChord[],
  tunings: SerializableTuning[],
) {
  // Clear only old note events. The beat cursor is now managed separately.
  scheduledEventIds.forEach((id) => transport.clear(id));
  scheduledEventIds = [];

  // Re-collect chord/note events
  const noteEventIds: number[] = [];
  totalSlots = 0;
  const chordsMap = new Map(chords.map((c) => [c.id, c]));
  const tuningsMap = new Map(tunings.map((t) => [t.name, t.notes.split(" ")]));
  let totalDuration = 0;
  const flatEventList: { time: number; notes: string[] }[] = [];

  pattern.forEach((section) => {
    const [beats, beatType] = section.timeSignature.split("/").map(Number);
    const subdivisionsPerBeat = beatType === 8 ? 2 : 4;
    const slotsPerMeasure = beats * subdivisionsPerBeat;
    const sixteenthNoteDuration = Time("16n").toSeconds();
    const measureDuration = slotsPerMeasure * sixteenthNoteDuration;

    section.measures.forEach((measure) => {
      measure.slots.forEach((chordId, slotIndex) => {
        if (!chordId) return;

        const chord = chordsMap.get(chordId);
        if (!chord) return;

        const tuningNotes = tuningsMap.get(chord.tuning);
        if
          (!tuningNotes) return;

        const notesToPlay = calculateChordNotes(chord.tab, tuningNotes);
        const eventTime = totalDuration + slotIndex * sixteenthNoteDuration;

        flatEventList.push({ time: eventTime, notes: notesToPlay });
      });
      totalDuration += measureDuration;
      totalSlots += slotsPerMeasure; // Count all slots
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
      noteEventIds.push(eventId);
    });
    transport.loopEnd = totalDuration;
  } else {
    transport.loopEnd = "1m";
    totalSlots = 1;
  }

  scheduledEventIds = [...noteEventIds];
  // Finally, schedule the beat cursor whenever the pattern changes
  scheduleBeatCursor(totalDuration);
}

// NEW: Function to toggle (start/pause) playback
export async function togglePlayback() {
  if (transport.state === "stopped" || transport.state === "paused") {
    await startAudio();
    transport.start();
  } else {
    // When pausing, we manually reset the beat index
    if (sendToMachine) {
      sendToMachine({ type: "UPDATE_ACTIVE_BEAT", beat: Math.floor(transport.seconds / Time("16n").toSeconds()) % totalSlots });
    }
    transport.pause();
  }
}

// NEW: Function to stop playback and rewind
export function stopAndRewind() {
  transport.stop();
  transport.position = 0;
  if (sendToMachine) {
    sendToMachine({ type: "UPDATE_ACTIVE_BEAT", beat: -1 });
  }
}
