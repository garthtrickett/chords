// src/components/ChordBank.ts
import { html, nothing } from "lit-html";
import type { SerializableChord, SerializableTuning } from "../../types/app";
import { appActor } from "../client";
import { ChordEditorForm } from "./ChordEditorForm";
import {
  baseInputClasses,
  destructiveButtonClasses, // <-- FIX: Import missing style
  labelClasses,
  primaryButtonClasses,
  secondaryButtonClasses, // <-- FIX: Import missing style
} from "./styles";

// --- UTILITIES ---
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_MAP: Record<string, number> = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6,
  "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
};
function calculateNotesFromTab(tab: string, tuningNotes: string[]): string[] {
  const notes: string[] = [];
  for (let i = 0; i < 6; i++) {
    const fret = tab[i];
    if (fret === "x" || fret === "X" || fret === undefined) {
      notes.push("x");
      continue;
    }
    const fretNum = parseInt(fret, 10);
    if (isNaN(fretNum)) {
      notes.push("?");
      continue;
    }
    const openStringNote = tuningNotes[i]?.toUpperCase();
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
      const tab = tabInputs
        .map((input) =>
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
              name="fret-${5 - i}"
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
      // --- START OF FIX ---
      // The entire block for displaying a chord was missing and is now restored.
      return html`
          <div class="p-3 bg-zinc-800 rounded">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-semibold text-zinc-300">${chord.name}</span>
                <span class="text-sm text-zinc-500 ml-2"
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
              ${notes.map(
          (note) => html`<span class="w-6 text-center">${note}</span>`,
        )}
            </div>
          </div>
        `;
      // --- END OF FIX ---
    })}
      ${savedChords.length === 0
      ? html`<p class="text-zinc-500 text-center py-4">
            No chords saved yet.
          </p>`
      : nothing}
    </div>
  `;
};
