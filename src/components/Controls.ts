// src/components/Controls.ts
import { html, nothing } from "lit-html";
import { appActor } from "../client";
import {
  baseInputClasses,
  destructiveButtonClasses,
  labelClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "./styles";
const ALL_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const Controls = (props: {
  isAudioOn: boolean;
  isSaving: boolean;
  patternName: string;
  selectedPatternId: string | null;
  viewMode: "json" | "visual";
  keyRoot: string;
  keyType: "major" | "minor";
  instrument: "piano" | "guitar";
}) => html`<div
  class="mt-6 flex flex-col sm:flex-row flex-wrap gap-4 items-center justify-between"
>
  ${props.selectedPatternId
    ? html`<div class="flex gap-4 items-center justify-center">
        ${props.isAudioOn
        ? html`<button
              class=${destructiveButtonClasses}
              @click=${() => appActor.send({ type: "STOP_AUDIO" })}
            >
              Stop Audio
            </button>`
        : html`<button
              class=${primaryButtonClasses}
              @click=${() => appActor.send({ type: "START_AUDIO" })}
            >
              Start Audio
            </button>`}
      </div>`
    : html`<div></div>`}
  ${props.selectedPatternId
    ? html`<div class="flex-shrink-0">
        <label class="${labelClasses} text-center sm:text-left">Key</label>
        <div class="flex gap-2">
          <select
            class="${baseInputClasses} w-20"
            @change=${(e: Event) =>
        appActor.send({
          type: "SET_KEY_ROOT",
          root: (e.target as HTMLSelectElement).value,
        })}
          >
            ${ALL_NOTES.map(
          (note) =>
            html`<option .value=${note} ?selected=${note === props.keyRoot}>
                  ${note}
                </option>`,
        )}
          </select>
          <select
            class="${baseInputClasses} w-28"
            @change=${(e: Event) =>
        appActor.send({
          type: "SET_KEY_TYPE",
          keyType: (e.target as HTMLSelectElement).value as
            | "major"
            | "minor",
        })}
          >
            <option value="major" ?selected=${props.keyType === "major"}>
              Major
            </option>
            <option value="minor" ?selected=${props.keyType === "minor"}>
              Minor
            </option>
          </select>
        </div>
      </div>`
    : nothing}
</div>
<div
  class="mt-6 flex flex-col sm:flex-row flex-wrap gap-4 items-center justify-center"
>
  ${props.selectedPatternId
    ? html`<input
        type="text"
        class="${baseInputClasses} flex-grow"
        placeholder="Pattern Name"
        .value=${props.patternName}
        @input=${(e: Event) =>
        appActor.send({
          type: "UPDATE_PATTERN_NAME",
          value: (e.target as HTMLInputElement).value,
        })}
      />`
    : nothing}
  <button
    class=${secondaryButtonClasses}
    @click=${() => appActor.send({ type: "NEW_PATTERN" })}
  >
    New Pattern
  </button>
  ${props.selectedPatternId
    ? html`<div class="flex-shrink-0">
          <label for="instrument-select" class="${labelClasses} text-center sm:text-left">Instrument</label>
          <select
            id="instrument-select"
            class="${baseInputClasses} w-32"
            @change=${(e: Event) => {
        appActor.send({
          type: "SET_INSTRUMENT",
          instrument: (e.target as HTMLSelectElement).value as "piano" | "guitar",
        });
      }}
          >
            <option value="piano" ?selected=${props.instrument === "piano"}>Piano</option>
            <option value="guitar" ?selected=${props.instrument === "guitar"}>Guitar</option>
          </select>
        </div>
        <button
          class=${secondaryButtonClasses}
          @click=${() => appActor.send({ type: "TOGGLE_VIEW" })}
        >
          ${props.viewMode === "json" ? "Visual View" : "JSON View"}
        </button>
        <button
          class=${primaryButtonClasses}
          ?disabled=${!props.patternName.trim() ||
      props.isSaving ||
      !props.selectedPatternId}
          @click=${() => {
        const latest = appActor.getSnapshot();
        if (latest.context.selectedPatternId) {
          appActor.send({
            type: "UPDATE_SAVED_PATTERN",
            input: {
              id: latest.context.selectedPatternId,
              name: latest.context.patternName,
              content: JSON.stringify(latest.context.currentPattern),
              key_root: latest.context.keyRoot,
              key_type: latest.context.keyType,
            },
          });
        }
      }}
        >
          ${props.isSaving ? "Saving..." : "Save Pattern"}
        </button>`
    : nothing}
</div>`;
