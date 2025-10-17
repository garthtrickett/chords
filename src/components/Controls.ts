// src/components/Controls.ts
import { html } from "lit-html";
import { appActor } from "../client";
import {
  baseInputClasses,
  destructiveButtonClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "./styles";

export const Controls = (props: {
  isAudioOn: boolean;
  isSaving: boolean;
  patternName: string;
  selectedPatternId: string | null;
  viewMode: "json" | "visual";
}) => html`<div
  class="mt-6 flex flex-col sm:flex-row flex-wrap gap-4 items-center justify-center"
>
  ${!props.isAudioOn
    ? html`<button
        class=${primaryButtonClasses}
        @click=${() => appActor.send({ type: "START_AUDIO" })}
      >
        Start Audio
      </button>`
    : html`<button
        class=${destructiveButtonClasses}
        @click=${() => appActor.send({ type: "STOP_AUDIO" })}
      >
        Stop Audio
      </button>`}
  <input
    type="text"
    class="${baseInputClasses} flex-grow"
    placeholder="Pattern Name"
    .value=${props.patternName}
    @input=${(e: Event) =>
    appActor.send({
      type: "UPDATE_PATTERN_NAME",
      value: (e.target as HTMLInputElement).value,
    })}
  />
  <button
    class=${secondaryButtonClasses}
    @click=${() => appActor.send({ type: "NEW_PATTERN" })}
  >
    New Pattern
  </button>
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
          content: latest.context.currentPattern,
        },
      });
    }
  }}
  >
    ${props.isSaving ? "Saving..." : "Save Pattern"}
  </button>
</div>`;
