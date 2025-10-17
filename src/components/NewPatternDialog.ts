// src/components/NewPatternDialog.ts
import { html } from "lit-html";
import { appActor } from "../client";
import {
  baseInputClasses,
  cardClasses,
  labelClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "./styles";

export const NewPatternDialog = (newPatternName: string) => html`<div
  class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
  @click=${(e: Event) => {
    if (e.currentTarget === e.target)
      appActor.send({ type: "CANCEL_NEW_PATTERN" });
  }}
>
  <div class="${cardClasses} w-full max-w-sm">
    <h3 class="text-lg font-medium mb-4 text-zinc-50">Create New Pattern</h3>
    <label for="new-pattern-name" class="${labelClasses}">Pattern Name</label>
    <input
      id="new-pattern-name"
      type="text"
      class="${baseInputClasses}"
      placeholder="e.g., 'Ambient Arp'"
      .value=${newPatternName}
      @input=${(e: Event) =>
    appActor.send({
      type: "UPDATE_NEW_PATTERN_NAME",
      value: (e.target as HTMLInputElement).value,
    })}
      @keydown=${(e: KeyboardEvent) => {
    if (e.key === "Enter")
      appActor.send({ type: "CREATE_PATTERN", name: newPatternName });
  }}
    />
    <div class="mt-6 flex justify-end gap-3">
      <button
        class=${secondaryButtonClasses}
        @click=${() => appActor.send({ type: "CANCEL_NEW_PATTERN" })}
      >
        Cancel</button
      ><button
        class=${primaryButtonClasses}
        ?disabled=${!newPatternName.trim()}
        @click=${() =>
    appActor.send({ type: "CREATE_PATTERN", name: newPatternName })}
      >
        Create
      </button>
    </div>
  </div>
</div>`;
