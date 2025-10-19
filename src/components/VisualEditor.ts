// src/components/VisualEditor.ts
import { html } from "lit-html";
import { appActor } from "../client";
import type { NoteEvent, PatternSection, Measure } from "../../types/app";
import {
  baseInputClasses,
  destructiveButtonClasses,
  secondaryButtonClasses,
} from "./styles";

const TIME_SIGNATURES = ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8"];

const renderNote = (note: NoteEvent) => html`
  <div
    class="bg-cyan-800/50 p-1 rounded text-xs text-center border border-cyan-700"
  >
    <div class="font-bold">${note.note}</div>
    <div class="text-cyan-300">${note.duration}</div>
  </div>
`;

const renderMeasure = (
  sectionId: string,
  measure: Measure,
  timeSignature: string,
) => {
  const [beats] = timeSignature.split("/").map(Number);
  return html`
    <div class="bg-zinc-800 p-2 rounded-md flex-shrink-0 w-48">
      <div class="grid grid-cols-${beats} gap-1 h-full">
        ${measure.notes.length > 0
      ? measure.notes.map(renderNote)
      : html`<div
              class="col-span-${beats} text-center text-zinc-600 text-sm flex items-center justify-center"
            >
              Empty
            </div>`}
      </div>
    </div>
  `;
};

const renderSection = (section: PatternSection) => html`
  <div
    class="flex flex-col gap-2 p-3 bg-zinc-900 border border-zinc-700 rounded-lg"
  >
    <div class="flex justify-between items-center mb-2">
      <select
        class="${baseInputClasses} !h-8 !py-0 w-24"
        @change=${(e: Event) =>
    appActor.send({
      type: "UPDATE_SECTION_TIME_SIGNATURE",
      sectionId: section.id,
      timeSignature: (e.target as HTMLSelectElement).value,
    })}
      >
        ${TIME_SIGNATURES.map(
      (sig) =>
        html`<option
              .value=${sig}
              ?selected=${sig === section.timeSignature}
            >
              ${sig}
            </option>`,
    )}
      </select>
      <button
        class="${destructiveButtonClasses} !h-8 !px-3 !text-xs"
        @click=${() =>
    appActor.send({ type: "DELETE_SECTION", sectionId: section.id })}
      >
        Delete Section
      </button>
    </div>
    <div class="flex gap-2 overflow-x-auto pb-2">
      ${section.measures.map((measure) =>
      renderMeasure(section.id, measure, section.timeSignature),
    )}
    </div>
  </div>
`;

export const VisualEditor = (
  currentPattern: PatternSection[],
  notesInKey: string[],
) => {
  return html`<div
    class="space-x-4 flex items-start p-4 border border-zinc-700 rounded-lg bg-zinc-950/50 min-h-[240px] overflow-x-auto"
  >
    ${currentPattern.map(renderSection)}
    <button
      class="${secondaryButtonClasses} h-full flex-shrink-0"
      @click=${() => appActor.send({ type: "ADD_SECTION" })}
    >
      + Add Section
    </button>
  </div>`;
};
