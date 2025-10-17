// src/components/ChordEditorForm.ts
import { html } from "lit-html";
import type { SerializableChord, SerializableTuning } from "../../types/app";
import { appActor } from "../client";
import {
  baseInputClasses,
  labelClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "./styles";

export const ChordEditorForm = (
  chord: SerializableChord,
  savedTunings: SerializableTuning[],
) => html`
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
      .map((input) => (input.value.trim() === "" ? "x" : input.value.trim()))
      .join("");

    if (name.trim() && tab.length === 6 && chord.id) {
      appActor.send({
        type: "UPDATE_CHORD",
        input: { id: chord.id, name, tab, tuning },
      });
    }
  }}
    class="p-3 bg-zinc-700 rounded my-3 space-y-4"
  >
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="md:col-span-1">
        <label for="chord-name-${chord.id}" class=${labelClasses}
          >Chord Name</label
        >
        <input
          id="chord-name-${chord.id}"
          name="chord-name"
          type="text"
          class=${baseInputClasses}
          .value=${chord.name}
          required
        />
      </div>
      <div class="md:col-span-2">
        <label for="chord-tuning-${chord.id}" class=${labelClasses}
          >Tuning</label
        >
        <select
          id="chord-tuning-${chord.id}"
          name="chord-tuning"
          class="${baseInputClasses}"
        >
          ${savedTunings.map(
    (tuning) =>
      html`<option
                .value=${tuning.name}
                ?selected=${tuning.name === chord.tuning}
              >
                ${tuning.name} (${tuning.notes})
              </option>`,
  )}
        </select>
      </div>
    </div>
    <div>
      <label class=${labelClasses}>Tablature (e B G D A E)</label>
      <div class="grid grid-cols-6 gap-2">
        ${chord.tab
    .split("")
    .map(
      (fret, i) => html`<input
            type="text"
            name="fret-${i}"
            class="${baseInputClasses} font-mono text-center"
            maxlength="2"
            placeholder="x"
            .value=${fret.toLowerCase() === "x" ? "" : fret}
          />`,
    )}
      </div>
    </div>
    <div class="flex justify-end gap-2">
      <button
        type="button"
        @click=${() => appActor.send({ type: "CANCEL_EDIT_CHORD" })}
        class=${secondaryButtonClasses}
      >
        Cancel</button
      ><button type="submit" class=${primaryButtonClasses}>Save Changes</button>
    </div>
  </form>
`;
