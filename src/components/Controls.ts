// src/components/Controls.ts
import { html, nothing } from "lit-html";
import { appActor } from "../client";
import * as player from "../audio/player"; // Import player to access new functions
import {
  baseInputClasses,
  destructiveButtonClasses,
  labelClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "./styles";
const ALL_NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
export const Controls = (props: {
  isAudioOn: boolean;
  isSaving: boolean;
  patternName: string;
  selectedPatternId: string | null;
  viewMode: "json" | "visual";
  keyRoot: string;
  keyType: "major" | "minor";
  instrument: "piano" | "guitar";
  bpm: number;
}) => html`<div
    class="mt-6 flex flex-col sm:flex-row flex-wrap gap-4 items-center justify-between"
  >
    ${props.selectedPatternId
    ? html`<div class="flex gap-4 items-center justify-center">
          <button
            class=${props.isAudioOn
        ? secondaryButtonClasses
        : primaryButtonClasses}
            @click=${() => {
        player.togglePlayback();
        appActor.send({ type: "TOGGLE_PLAYBACK" });
      }}
          >
            ${props.isAudioOn ? "Pause Playback" : "Start Playback"}
          </button>

          <button
            class=${destructiveButtonClasses}
            @click=${() => {
        // <-- REMOVED ?disabled=${!props.isAudioOn}
        player.stopAndRewind();
        appActor.send({ type: "STOP_AND_REWIND" });
      }}
          >
            Stop & Rewind
          </button>
        </div>`
    : html`<div></div>`}
    ${props.selectedPatternId
    ? html`<div class="flex-shrink-0">
            <label class="${labelClasses} text-center sm:text-left">BPM</label>
            <div class="flex gap-2 items-center">
              <input
                type="range"
                min="40"
                max="240"
                .value=${props.bpm}
                class="w-32 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                @input=${(e: Event) => {
        const newBpm = parseInt(
          (e.target as HTMLInputElement).value,
          10,
        );
        appActor.send({ type: "SET_BPM", value: newBpm });
      }}
              />
              <input
                type="number"
                min="40"
                max="240"
                .value=${props.bpm}
                class="${baseInputClasses} w-20 text-center"
                @input=${(e: Event) => {
        const newBpm = parseInt(
          (e.target as HTMLInputElement).value,
          10,
        );
        if (!isNaN(newBpm)) {
          appActor.send({ type: "SET_BPM", value: newBpm });
        }
      }}
              />
            </div>
          </div>
          <div class="flex-shrink-0">
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
            html`<option .value=${note} ?selected=${note ===
              props.keyRoot}>
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
            <label
              for="instrument-select"
              class="${labelClasses} text-center sm:text-left"
              >Instrument</label
            >
            <select
              id="instrument-select"
              class="${baseInputClasses} w-32"
              @change=${(e: Event) => {
        appActor.send({
          type: "SET_INSTRUMENT",
          instrument: (e.target as HTMLSelectElement).value as
            | "piano"
            | "guitar",
        });
      }}
            >
              <option value="piano" ?selected=${props.instrument === "piano"}>
                Piano
              </option>
              <option value="guitar" ?selected=${props.instrument === "guitar"}>
                Guitar
              </option>
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
              chord_palette: JSON.stringify(latest.context.chordPalette),
            },
          });
        }
      }}
          >
            ${props.isSaving ? "Saving..." : "Save Pattern"}
          </button>`
    : nothing}
  </div>`;
