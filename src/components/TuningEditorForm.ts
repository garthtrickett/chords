// src/components/TuningEditorForm.ts
import { html } from "lit-html";
import type { SerializableTuning } from "../../types/app";
import { appActor } from "../client";
import {
  baseInputClasses,
  labelClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "./styles";

export const TuningEditorForm = (tuning: SerializableTuning) => html`
  <form
    @submit=${(e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const name = formData.get("tuning-name") as string;
    const noteInputs = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name^="note-"]'),
    );
    const notes = noteInputs.map((input) => input.value.trim()).join(" ");

    if (name.trim() && notes.trim().split(" ").length === 6 && tuning.id) {
      appActor.send({
        type: "UPDATE_TUNING",
        input: { id: tuning.id, name, notes },
      });
    }
  }}
    class="p-3 bg-zinc-700 rounded my-2 space-y-4"
  >
    <div>
      <label for="tuning-name-${tuning.id}" class=${labelClasses}
        >Tuning Name</label
      >
      <input
        id="tuning-name-${tuning.id}"
        name="tuning-name"
        type="text"
        class=${baseInputClasses}
        .value=${tuning.name}
        required
      />
    </div>
    <div>
      <label class=${labelClasses}>Notes (6th to 1st string)</label>
      <div class="grid grid-cols-6 gap-2">
        ${tuning.notes
    .split(" ")
    .map(
      (note, i) => html`<input
            type="text"
            name="note-${i}"
            class="${baseInputClasses} font-mono text-center"
            maxlength="2"
            .value=${note}
            required
          />`,
    )}
      </div>
    </div>
    <div class="flex justify-end gap-2">
      <button
        type="button"
        @click=${() => appActor.send({ type: "CANCEL_EDIT_TUNING" })}
        class=${secondaryButtonClasses}
      >
        Cancel</button
      ><button type="submit" class=${primaryButtonClasses}>Save Changes</button>
    </div>
  </form>
`;
