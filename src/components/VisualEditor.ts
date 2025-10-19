// src/components/VisualEditor.ts
import { html } from "lit-html";
import { appActor } from "../client";
import type {
  PatternSection,
  Measure,
  SerializableChord,
} from "../../types/app";
import {
  baseInputClasses,
  destructiveButtonClasses,
  secondaryButtonClasses,
} from "./styles";
const TIME_SIGNATURES = [
  "2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "9/8", "11/8", "12/8", "13/8", "15/8",
];
const renderSlot = (
  sectionId: string,
  measure: Measure,
  slotIndex: number,
  chordsMap: Map<string, SerializableChord>,
  activeSlot: { sectionId: string; measureId: string; slotIndex: number } | null,
) => {
  const chordId = measure.slots[slotIndex];
  const chord = chordId ? chordsMap.get(chordId) : null;
  const isActive =
    activeSlot?.sectionId === sectionId &&
    activeSlot?.measureId === measure.id &&
    activeSlot?.slotIndex === slotIndex;
  const slotClasses = `
    relative group flex items-center justify-center rounded text-center border h-12 text-xs min-w-16
    ${isActive
      ? "bg-teal-400/20 border-teal-400"
      : "bg-zinc-700/50 border-zinc-600 hover:border-zinc-400"
    }
    cursor-pointer transition-colors
  `;
  return html`
    <div
      class=${slotClasses}
      @click=${() =>
      appActor.send({
        type: "SELECT_SLOT",
        sectionId,
        measureId: measure.id,
        slotIndex,
      })}
    >
      ${chord
      ? html`
            <span class="font-medium text-zinc-200">${chord.name}</span>
            <button
              class="absolute top-0 right-0 w-4 h-4 flex items-center justify-center bg-red-500/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              @click=${(e: Event) => {
          e.stopPropagation(); // Prevent the modal from opening
          appActor.send({
            type: "CLEAR_SLOT",
            sectionId,
            measureId: measure.id,
            slotIndex,
          });
        }}
            >
              &times;
            </button>
          `
      : html`<span class="text-zinc-600">+</span>`}
    </div>
  `;
};

const renderMeasure = (
  section: PatternSection,
  measure: Measure,
  chordsMap: Map<string, SerializableChord>,
  activeSlot: { sectionId: string; measureId: string; slotIndex: number } | null,
) => {
  const [beats, beatType] = section.timeSignature.split("/").map(Number);
  const subdivisions = beatType === 8 ? 2 : 4;
  const beatSlots = Array.from({ length: beats }, (_, i) =>
    measure.slots.slice(i * subdivisions, (i + 1) * subdivisions),
  );
  return html`
    <div class="bg-zinc-800 p-2 rounded-md flex-shrink-0">
      <div
        class="grid gap-2 h-full"
        style="grid-template-columns: repeat(${beats}, minmax(0, 1fr));"
      >
        ${beatSlots.map(
    (slots, beatIndex) => html`
            <div
              class="grid gap-1"
              style="grid-template-columns: repeat(${subdivisions}, minmax(0, 1fr));"
            >
              ${slots.map((_, subdivisionIndex) => {
      const slotIndex = beatIndex * subdivisions + subdivisionIndex;
      return renderSlot(
        section.id,
        measure,
        slotIndex,
        chordsMap,
        activeSlot,
      );
    })}
            </div>
          `,
  )}
      </div>
    </div>
  `;
};

const renderSection = (
  section: PatternSection,
  chordsMap: Map<string, SerializableChord>,
  activeSlot: { sectionId: string; measureId: string; slotIndex: number } | null,
) => html`
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
    <div class="flex gap-2 overflow-x-auto pb-2 items-center">
      ${section.measures.map((measure) =>
      renderMeasure(section, measure, chordsMap, activeSlot),
    )}
      <button
        class="${secondaryButtonClasses} !h-12 !w-12 flex-shrink-0 flex items-center justify-center text-2xl"
        @click=${() =>
    appActor.send({ type: "ADD_MEASURE", sectionId: section.id })}
      >
        +
      </button>
    </div>
  </div>
`;
export const VisualEditor = (
  currentPattern: PatternSection[],
  savedChords: SerializableChord[],
  activeSlot: { sectionId: string; measureId: string; slotIndex: number } | null,
) => {
  const chordsMap = new Map(
    savedChords.filter((c) => c.id).map((c) => [c.id as string, c]),
  );
  return html`
    <div
      class="w-full"
      @click=${(e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[class*="cursor-pointer"], button, select')) {
        appActor.send({ type: "CLEAR_SLOT_SELECTION" });
      }
    }}
    >
      <div
        class="gap-4 flex flex-wrap items-start p-4 border border-zinc-700 rounded-lg bg-zinc-950/50 min-h-[320px]"
      >
        ${currentPattern.map((section) =>
      renderSection(section, chordsMap, activeSlot),
    )}
        <button
          class="${secondaryButtonClasses} h-full flex-shrink-0 self-stretch"
          @click=${() => appActor.send({ type: "ADD_SECTION" })}
        >
          + Add Section
        </button>
      </div>
    </div>
  `;
};
