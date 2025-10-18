// src/components/ChordBank.ts
import { html, nothing } from "lit-html";
import { Chord, Key, Scale } from "tonal";
import type { SerializableChord, SerializableTuning } from "../../types/app";
import { appActor } from "../client";
import { ChordEditorForm } from "./ChordEditorForm";
import {
  baseInputClasses,
  destructiveButtonClasses,
  labelClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "./styles";

// --- UTILITIES ---
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_MAP: Record<string, number> = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6,
  "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
};

// --- Music Theory Logic ---
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]; // W, W, H, W, W, W, H
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // W, H, W, W, H, W, W
const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

/**
 * Generates a detailed Roman numeral by analyzing a chord within a key.
 * @param chordSymbol The symbol of the chord to analyze (e.g., "G", "Am", "G7").
 * @param keyRoot The root of the key (e.g., "C").
 * @param keyType The type of the key (e.g., "major").
 * @returns The detailed Roman numeral string (e.g., "V", "vi", "V7") or an empty string.
 */
function getAdvancedRomanNumeral(
  chordSymbol: string,
  keyRoot: string,
  keyType: "major" | "minor",
): string {
  if (!chordSymbol) return "";
  const keyName = `${keyRoot} ${keyType}`;
  const scaleNotes = Scale.get(keyName).notes;
  const chord = Chord.get(chordSymbol);
  if (chord.empty || !chord.tonic) return "";

  const degree = scaleNotes.indexOf(chord.tonic) + 1;
  if (degree === 0 || degree > 7) return "";

  // FIX: Use a reliable array lookup instead of RomanNumeral.get()
  let finalRoman = ROMAN_NUMERALS[degree - 1];

  const diatonicTriads = (keyType === 'major' ? Key.majorKey(keyRoot).triads : Key.minorKey(keyRoot).natural.triads);
  const diatonicTriad = Chord.get(diatonicTriads[degree - 1]);

  if (diatonicTriad.quality === "Minor" || diatonicTriad.quality === "Diminished") {
    finalRoman = finalRoman.toLowerCase();
  }

  // Use chord.type for specific qualities not covered by chord.quality
  if (chord.type === "dominant 7th") {
    return finalRoman + "⁷";
  } else if (chord.type === "half-diminished 7th") {
    return finalRoman + "ø⁷";
  } else if (chord.quality === "Diminished") {
    return finalRoman + "°";
  } else if (chord.quality === "Augmented") {
    return finalRoman + "+";
  } else if (chord.type === "major 7th") {
    return finalRoman + "M⁷";
  } else if (chord.type === "minor 7th") {
    return finalRoman + "m⁷";
  }

  return finalRoman;
}


/**
 * Detects the most likely chord name from a set of notes and returns a standardized symbol.
 * This ensures the symbol (e.g., "G", "Am") matches the format used by Tonal's Key.triads.
 * @param notes - An array of note names (e.g., ['G', 'B', 'D']).
 * @returns The standardized chord symbol or an empty string if not found.
 */
function getChordDisplayName(notes: string[]): string {
  const uniqueNotes = [...new Set(notes)].filter((n) => n !== "x" && n !== "?");
  if (uniqueNotes.length < 2) return "";

  const detected = Chord.detect(uniqueNotes);
  if (detected.length === 0) return "";

  const chord = Chord.get(detected[0]);
  return chord.empty ? "" : chord.symbol;
}


/**
 * Finds all major and minor keys that contain a given set of chord notes.
 * @param chordNotes - An array of note names (e.g., ['G', 'B', 'D']).
 * @returns An array of strings representing the matching keys (e.g., ['G Major', 'E Minor']).
 */
function findMatchingKeys(chordNotes: string[]): string[] {
  const uniqueChordNotes = [...new Set(chordNotes)].filter(
    (n) => n !== "x" && n !== "?",
  );
  if (uniqueChordNotes.length === 0) return [];

  const matchingKeys: string[] = [];
  for (let i = 0; i < NOTES.length; i++) {
    const rootNote = NOTES[i];
    // Check Major keys
    const majorScale = new Set(
      MAJOR_INTERVALS.map((interval) => NOTES[(i + interval) % 12]),
    );
    if (uniqueChordNotes.every((note) => majorScale.has(note))) {
      matchingKeys.push(`${rootNote} Major`);
    }

    // Check Minor keys
    const minorScale = new Set(
      MINOR_INTERVALS.map((interval) => NOTES[(i + interval) % 12]),
    );
    if (uniqueChordNotes.every((note) => minorScale.has(note))) {
      matchingKeys.push(`${rootNote} Minor`);
    }
  }

  return matchingKeys;
}


function calculateNotesFromTab(tab: string, tuningNotes: string[]): string[] {
  const notes: string[] = [];
  // Assumes tab string is low E to high e (6th string to 1st string)
  for (let i = 0; i < 6; i++) {
    const fret = tab[i];
    // tuningNotes is also low E to high e, so we can use a direct index.
    const openStringNote = tuningNotes[i]?.toUpperCase();

    if (fret === "x" || fret === "X" || fret === undefined) {
      notes.push("x");
      continue;
    }
    const fretNum = parseInt(fret, 10);
    if (isNaN(fretNum)) {
      notes.push("?");
      continue;
    }

    if (!openStringNote || NOTE_MAP[openStringNote] === undefined) {
      notes.push("?");
      continue;
    }
    const openNoteIndex = NOTE_MAP[openStringNote];
    const finalNoteIndex = (openNoteIndex + fretNum) % 12;
    notes.push(NOTES[finalNoteIndex]);
  }
  return notes;
}


export const ChordBank = (
  savedChords: SerializableChord[],
  savedTunings: SerializableTuning[],
  editingChordId: string | null,
  keyRoot: string,
  keyType: "major" | "minor",
) => {
  const tuningsMap = new Map(
    savedTunings.map((t) => [t.name, t.notes.split(" ")]),
  );
  return html`
    <h3 class="text-lg font-medium mb-4 text-zinc-50">Chord Bank</h3>
    <form
      @submit=${(e: Event) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const name = formData.get("chord-name") as string;
      const tuning = formData.get("chord-tuning") as string;
      const tabInputs = Array.from(
        form.querySelectorAll<HTMLInputElement>('input[name^="fret-"]'),
      );
      // Construct tab string from low E to high e
      const tab = [...tabInputs].reverse().map((input) =>
        input.value.trim() === "" ? "x" : input.value.trim(),
      )
        .join("");
      if (name.trim() && tab.length === 6) {
        appActor.send({
          type: "CREATE_CHORD",
          input: { name, tab, tuning },
        });
        form.reset();
      }
    }}
      class="space-y-4 mb-6"
    >
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="md:col-span-1">
          <label for="chord-name" class=${labelClasses}>Chord Name</label>
          <input
            id="chord-name"
            name="chord-name"
            type="text"
            class=${baseInputClasses}
            placeholder="e.g., G Major"
            required
          />
        </div>
        <div class="md:col-span-2">
          <label for="chord-tuning" class=${labelClasses}>Tuning</label>
          <select
            id="chord-tuning"
            name="chord-tuning"
            class="${baseInputClasses}"
          >
            ${savedTunings.map(
      (tuning) =>
        html`<option .value=${tuning.name}>
                  ${tuning.name} (${tuning.notes})
                </option>`,
    )}
          </select>
        </div>
      </div>
      <div>
        <label class=${labelClasses}>Tablature (Strings e B G D A E)</label>
        <div class="grid grid-cols-6 gap-2">
          ${[...Array(6)].map(
      (_, i) => html`<input
              type="text"
              name="fret-${i}"
              class="${baseInputClasses} font-mono text-center"
              maxlength="2"
              placeholder="x"
            />`,
    )}
        </div>
      </div>
      <div class="flex justify-end">
        <button type="submit" class=${primaryButtonClasses}>Add Chord</button>
      </div>
    </form>
    <div class="space-y-3">
      ${savedChords.map((chord) => {
      if (editingChordId === chord.id) {
        return ChordEditorForm(chord, savedTunings);
      }
      const tuningNotes = tuningsMap.get(chord.tuning);
      const notes = tuningNotes
        ? calculateNotesFromTab(chord.tab, tuningNotes)
        : Array(6).fill("?");

      const matchingKeys = findMatchingKeys(notes);
      const detectedChordName = getChordDisplayName(notes);
      const romanNumeralInCurrentKey = getAdvancedRomanNumeral(
        detectedChordName,
        keyRoot,
        keyType,
      );

      return html`
          <div class="p-3 bg-zinc-800 rounded">
            <div class="flex items-center justify-between">
              <div class="flex items-baseline gap-2">
                <span class="font-semibold text-zinc-300">${chord.name}</span>
                ${detectedChordName
          ? html`<span
                      class="text-sm text-lime-400 font-mono"
                      >${detectedChordName}</span
                    >`
          : nothing}
                ${romanNumeralInCurrentKey
          ? html`<span
                      class="text-sm text-purple-400 font-mono"
                      >(${romanNumeralInCurrentKey})</span
                    >`
          : nothing}
                <span class="text-sm text-zinc-500"
                  >(${chord.tuning})</span
                >
              </div>
              <div class="flex items-center gap-4">
                <div class="font-mono text-cyan-400 flex gap-x-2 text-lg">
                  ${chord.tab
          .split("")
          .map((fret) => html`<span>${fret}</span>`)}
                </div>
                <div class="flex gap-2">
                  <button
                    @click=${() => {
          if (chord.id)
            appActor.send({
              type: "LOAD_CHORD_INTO_PATTERN",
              chordId: chord.id,
            });
        }}
                    class="${secondaryButtonClasses} h-8 px-3 text-xs"
                  >
                    Load
                  </button>
                  <button
                    @click=${() => {
          if (chord.id)
            appActor.send({ type: "EDIT_CHORD", id: chord.id });
        }}
                    class="${secondaryButtonClasses} h-8 px-3 text-xs"
                  >
                    Edit</button
                  ><button
                    @click=${() => {
          if (chord.id)
            appActor.send({ type: "DELETE_CHORD", id: chord.id });
        }}
                    class="${destructiveButtonClasses} h-8 px-3 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
            <div
              class="font-mono text-amber-400 flex justify-end gap-x-2 text-sm mt-1"
            >
              ${[...notes].reverse().map(
          (note) => html`<span class="w-6 text-center">${note}</span>`,
        )}
            </div>
            ${matchingKeys.length > 0
          ? html`<div class="mt-2 pt-2 border-t border-zinc-700">
                  <p class="text-xs text-zinc-400 font-medium mb-1">
                    Works in:
                  </p>
                  <div class="flex flex-wrap gap-1">
                    ${matchingKeys.map((key) => {
            const [root, type] = key.split(" ");
            const numeral = getAdvancedRomanNumeral(
              detectedChordName,
              root,
              type.toLowerCase() as "major" | "minor",
            );
            return html`<span
                          class="bg-teal-900/50 text-teal-300 text-xs font-mono px-2 py-0.5 rounded-full"
                          >${key}
                          ${numeral
                ? html`<span class="text-purple-300/80"
                                >(${numeral})</span
                              >`
                : nothing}</span
                        >`;
          })}
                  </div>
                </div>`
          : nothing}
          </div>
        `;
    })}
      ${savedChords.length === 0
      ? html`<p class="text-zinc-500 text-center py-4">
            No chords saved yet.
          </p>`
      : nothing}
    </div>
  `;
};
