// src/components/PatternLoader.ts
import { html } from "lit-html";
import type { SerializablePattern } from "../../types/app";
import { appActor } from "../client";
import {
  baseInputClasses,
  destructiveButtonClasses,
  labelClasses,
} from "./styles";

export const PatternLoader = (
  savedPatterns: SerializablePattern[],
  selectedId: string | null,
) => html`<label for="load-select" class=${labelClasses}>Load a Pattern</label>
  <div class="flex gap-2">
    <select
      id="load-select"
      class="${baseInputClasses} w-full"
      @change=${(e: Event) =>
    appActor.send({
      type: "SELECT_PATTERN",
      id: (e.target as HTMLSelectElement).value,
    })}
    >
      <option value="" ?selected=${!selectedId}>
        Select a saved pattern...
      </option>
      ${savedPatterns.map(
      (p) =>
        html`<option .value=${p.id ?? ""} ?selected=${p.id === selectedId}>
            ${p.name}
          </option>`,
    )}
    </select>
    <button
      class=${destructiveButtonClasses}
      ?disabled=${!selectedId}
      @click=${() => {
    if (selectedId) {
      if (confirm("Are you sure you want to delete this pattern?")) {
        appActor.send({ type: "DELETE_PATTERN", id: selectedId });
      }
    }
  }}
    >
      Delete
    </button>
  </div>`;
