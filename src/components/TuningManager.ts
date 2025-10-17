// src/components/TuningManager.ts
import { html } from "lit-html";
import type { SerializableTuning } from "../../types/app";
import { appActor } from "../client";
import { TuningEditorForm } from "./TuningEditorForm";
import {
  baseInputClasses,
  destructiveButtonClasses,
  labelClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "./styles";

export const TuningManager = (
  savedTunings: SerializableTuning[],
  editingTuningId: string | null,
) => html`
  <h3 class="text-lg font-medium mb-4 text-zinc-50">Tuning Manager</h3>
  <form
    @submit=${(e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const name = formData.get("tuning-name") as string;
    const noteInputs = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name^="note-"]'),
    );
    const notes = noteInputs.map((input) => input.value).join(" ");

    if (name.trim() && notes.trim().split(" ").length === 6) {
      appActor.send({ type: "CREATE_TUNING", input: { name, notes } });
      form.reset();
    }
  }}
    class="space-y-4 mb-6 p-4 border border-zinc-800 rounded-lg"
  >
    <h4 class="font-medium text-zinc-300">Add New Tuning</h4>
    <div>
      <label for="tuning-name" class=${labelClasses}>Tuning Name</label>
      <input
        id="tuning-name"
        name="tuning-name"
        type="text"
        class=${baseInputClasses}
        placeholder="e.g., Open C"
        required
      />
    </div>
    <div>
      <label class=${labelClasses}>Notes (6th to 1st string)</label>
      <div class="grid grid-cols-6 gap-2">
        ${[...Array(6)].map(
    (_, i) => html`<input
            type="text"
            name="note-${i}"
            class="${baseInputClasses} font-mono text-center"
            maxlength="2"
            required
          />`,
  )}
      </div>
    </div>
    <div class="flex justify-end">
      <button type="submit" class=${primaryButtonClasses}>Save Tuning</button>
    </div>
  </form>
  <div class="space-y-2">
    ${savedTunings.map((tuning) => {
    if (editingTuningId === tuning.id) {
      return TuningEditorForm(tuning);
    }
    return html`
        <div class="flex items-center justify-between p-3 bg-zinc-800 rounded">
          <div>
            <span class="font-semibold text-zinc-300">${tuning.name}</span>
            <span class="font-mono text-cyan-400 ml-4">${tuning.notes}</span>
          </div>
          <div class="flex gap-2">
            <button
              @click=${() => {
        if (tuning.id)
          appActor.send({ type: "EDIT_TUNING", id: tuning.id });
      }}
              class="${secondaryButtonClasses} h-8 px-3 text-xs"
            >
              Edit</button
            ><button
              @click=${() => {
        if (tuning.id) {
          appActor.send({ type: "DELETE_TUNING", id: tuning.id });
        }
      }}
              class="${destructiveButtonClasses} h-8 px-3 text-xs"
            >
              Delete
            </button>
          </div>
        </div>
      `;
  })}
  </div>
`;
