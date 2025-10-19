// src/components/VisualEditor.ts
import { html, nothing } from "lit-html";
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
  // NEW: Pass the total index of the slot and the active beat
  currentTotalSlotIndex: number,
  activeBeat: number,
) => {
  const chordId = measure.slots[slotIndex];
  const chord = chordId ? chordsMap.get(chordId) : null;
  const isActiveSelection =
    activeSlot?.sectionId === sectionId &&
    activeSlot?.measureId === measure.id &&
    activeSlot?.slotIndex === slotIndex;

  // NEW: Check if this slot is the currently playing beat
  const isPlaying = activeBeat === currentTotalSlotIndex;

  const slotClasses = `
    relative group flex items-center justify-center rounded text-center border h-12 text-xs min-w-16
    ${isPlaying
      ? "bg-teal-700/50 border-teal-400" // New highlight class for playing slot
      : isActiveSelection
        ? "bg-teal-400/20 border-teal-400"
        : "bg-zinc-700/50 border-zinc-600 hover:border-zinc-400"
    }
    cursor-pointer transition-colors
  `;
  // Handler for when dragging of a chord slot begins
  const handleDragStart = (e: DragEvent) => {
    if (!chordId || !e.dataTransfer) {
      return;
    }
    // Set the data to be transferred (the source location of the chord)
    const dataToTransfer = JSON.stringify({
      sectionId,
      measureId: measure.id,
      slotIndex,
    });
    e.dataTransfer.setData(
      "application/json",
      dataToTransfer,
    );
    e.dataTransfer.effectAllowed = "move";
    // Set opacity directly within the event handler scope
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.4'; // Visual cue for the dragged element
  };
  // Handler for when a dragged chord is hovering over another slot
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    // This is necessary to allow a drop
    const target = e.currentTarget as HTMLElement;
    // Only provide a visual cue if the target slot is empty
    if (!chordId) {
      // Add yellow highlight classes to indicate a valid drop target
      if (!target.classList.contains("border-yellow-400")) {
        // Temporarily remove the zinc classes to ensure the yellow shows
        target.classList.remove("bg-zinc-700/50", "border-zinc-600", "hover:border-zinc-400");
        target.classList.add("border-yellow-400", "bg-yellow-400/20");
      }
    } else {
      // Ensure no yellow cue is applied to occupied slots
      target.classList.remove("border-yellow-400", "bg-yellow-400/20");
    }
  };

  // Handler for when a dragged chord leaves the hover area of another slot
  const handleDragLeave = (e: DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    // Remove the yellow highlight classes
    target.classList.remove("border-yellow-400", "bg-yellow-400/20");
    // Restore the original zinc classes
    if (!isActiveSelection) {
      target.classList.add("bg-zinc-700/50", "border-zinc-600", "hover:border-zinc-400");
    }
  };

  // Handler for when a chord is dropped onto a slot
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    // Clean up the visual cue
    target.classList.remove("border-yellow-400", "bg-yellow-400/20");
    // Restore zinc classes on drop if not active
    if (!isActiveSelection) {
      target.classList.add("bg-zinc-700/50", "border-zinc-600", "hover:border-zinc-400");
    }

    // Prevent dropping a chord onto a slot that is already occupied
    if (chordId) {
      return;
    }

    // Get the source data from the drag event
    const sourceData = e.dataTransfer?.getData("application/json");
    if (!sourceData) {
      return;
    }
    const source = JSON.parse(sourceData);
    // Send the event to the state machine to move the chord
    appActor.send({
      type: "MOVE_CHORD",
      source: {
        sectionId: source.sectionId,
        measureId: source.measureId,
        slotIndex: source.slotIndex,
      },
      target: {
        sectionId: sectionId,
        measureId: measure.id,
        slotIndex: slotIndex,

      },
    });
  };

  // Handler for when dragging of a chord slot ends
  const handleDragEnd = (e: DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1'; // Reset opacity
  };

  return html`
    <div
      class=${slotClasses}
      draggable=${chord ?
      "true" : "false"}
      @dragstart=${handleDragStart}
      @dragover=${handleDragOver}
      @dragleave=${handleDragLeave}
      @drop=${handleDrop}
      @dragend=${handleDragEnd}
      @click=${() => {
      appActor.send({
        type: "HIGHLIGHT_SLOT",
        sectionId,
        measureId: measure.id,
        slotIndex,
      });
    }}
    >
      ${chord
      ?
      html`<span class="font-medium text-zinc-200">${chord.name}</span>`
      : html`<span class="text-zinc-600">+</span>`}

      <button
        class="absolute top-0 left-0 w-5 h-5 flex items-center justify-center bg-zinc-600 hover:bg-teal-600 text-white rounded-br-lg opacity-0 group-hover:opacity-100 transition-all text-xs font-bold"
        @click=${(e: Event) => {
      e.stopPropagation();
      appActor.send({
        type: "SELECT_SLOT",
        sectionId,
        measureId: measure.id,
        slotIndex,
      });
    }}
      >
        ${chord ?
      "✎" : "+"}
      </button>

      ${chord
      ?
      html`
            <button
              class="absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-zinc-600 hover:bg-red-600 text-white rounded-bl-lg opacity-0 group-hover:opacity-100 transition-all text-sm"
              @click=${(e: Event) => {
          e.stopPropagation();
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
      : nothing}
    </div>
  `;
};

// MODIFIED: Accepts the running total of slots before this measure
const renderMeasure = (
  section: PatternSection,
  measure: Measure,
  chordsMap: Map<string, SerializableChord>,
  activeSlot: { sectionId: string; measureId: string; slotIndex: number } | null,
  activeBeat: number,
  totalSlotsBeforeMeasure: number, // NEW parameter
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
      const slotIndex = beatIndex * subdivisions
        + subdivisionIndex;
      const currentTotalSlotIndex = totalSlotsBeforeMeasure + slotIndex; // Calculate total index

      return renderSlot(
        section.id,
        measure,
        slotIndex,
        chordsMap,
        activeSlot,
        currentTotalSlotIndex, // Pass total index
        activeBeat, // Pass active beat
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
  activeBeat: number, // NEW parameter
  totalSlotsBeforeSection: number, // NEW parameter
) => {
  // --- Drag and Drop Handlers for Section ---
  const handleDragStart = (e: DragEvent) => {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData("text/plain", section.id);
    e.dataTransfer.effectAllowed = "move";
    // Add visual cue
    (e.currentTarget as HTMLElement).style.opacity = '0.4';
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault(); // Allow drop
    const sourceId = e.dataTransfer?.getData("text/plain");
    // Only apply visual cue if not dragging onto itself
    if (sourceId !== section.id) {
      (e.currentTarget as HTMLElement).classList.add('border-dashed', 'border-teal-400');
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('border-dashed', 'border-teal-400');
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('border-dashed', 'border-teal-400');

    const sourceId = e.dataTransfer?.getData("text/plain");
    if (sourceId && sourceId !== section.id) {
      appActor.send({
        type: "MOVE_SECTION",
        sourceId: sourceId,
        targetId: section.id,
      });
    }
  };

  const handleDragEnd = (e: DragEvent) => {
    // Reset visual cue on the source element
    (e.currentTarget as HTMLElement).style.opacity = '1';
  };

  // NEW: Calculate running beat index for measures
  let currentTotalSlots = totalSlotsBeforeSection;

  return html`
    <div
      class="flex flex-col gap-2 p-3 bg-zinc-900 border border-zinc-700 rounded-lg cursor-grab"
      draggable="true"
      @dragstart=${handleDragStart}
      @dragover=${handleDragOver}
      @dragleave=${handleDragLeave}
      @drop=${handleDrop}
      @dragend=${handleDragEnd}
    >
      <div class="flex justify-between items-center mb-2">
        <select
          class="${baseInputClasses} !h-8 !py-0 w-24"
          @change=${(e: Event) => {
      appActor.send({
        type: "UPDATE_SECTION_TIME_SIGNATURE",
        sectionId: section.id,

        timeSignature: (e.target as HTMLSelectElement).value,
      });
    }}
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
      <div class="flex gap-2">
        <button
          class="${secondaryButtonClasses} !h-8 !px-3 !text-xs"
          @click=${() => {
      appActor.send({ type: "DUPLICATE_SECTION", sectionId: section.id });
    }}
        >
          Duplicate
        </button>
        <button
          class="${destructiveButtonClasses} !h-8 !px-3 !text-xs"
          @click=${() => {
      appActor.send({ type: "DELETE_SECTION", sectionId: section.id });
    }}
        >
          Delete Section
        </button>
      </div>
    </div>
    <div class="flex gap-2 overflow-x-auto pb-2 items-center">
      ${section.measures.map((measure) => {
      const [beats, beatType] = section.timeSignature.split("/").map(Number);
      const slotsPerMeasure = beats * (beatType === 8 ? 2 : 4);
      const slotsBefore = currentTotalSlots;
      currentTotalSlots += slotsPerMeasure; // Update running total for the next measure

      return renderMeasure(
        section,
        measure,
        chordsMap,
        activeSlot,
        activeBeat,
        slotsBefore, // Pass the starting slot index
      );
    })}
      <button
        class="${secondaryButtonClasses} !h-12 !w-12 flex-shrink-0 flex items-center justify-center text-2xl"
        @click=${() => {
      appActor.send({
        type: "ADD_MEASURE",
        sectionId: section.id
      });
    }}
      >
        +
      </button>
    </div>
  </div>
`;
};

export const VisualEditor = (
  currentPattern: PatternSection[],
  savedChords: SerializableChord[],
  activeSlot: { sectionId: string; measureId: string; slotIndex: number } | null,
  activeBeat: number, // NEW: Active beat from the machine
) => {
  const chordsMap = new Map(
    savedChords.filter((c) => c.id).map((c) => [c.id as string, c]),
  );

  // NEW: Calculate total beat index across all sections
  let totalSlotsBeforeSection = 0;

  const _handleKeyDown = (e: KeyboardEvent) => {
    const snapshot = appActor.getSnapshot();
    if (snapshot.context.activeSlot) {
      if (e.ctrlKey && e.key === "c") {
        e.preventDefault();
        appActor.send({ type: "COPY_SLOT" });
      }
      if (e.ctrlKey && e.key === "v") {
        e.preventDefault();
        if (snapshot.context.clipboardChordId) {
          appActor.send({ type: "PASTE_SLOT" });
        }
      }
    }
  };
  return html`
    <div
      class="w-full"
      tabindex="0"
      @keydown=${_handleKeyDown}
      @click=${(e: Event) => {
      const target = e.target as HTMLElement;
      // Check if the click occurred on the editor container itself, not an interactive child.
      if (!target.closest('[class*="cursor-pointer"], button, select, input, form')) {
        appActor.send({ type: "CLEAR_SLOT_SELECTION" });
      }
    }}
    >
      <div
        class="gap-4 flex flex-wrap items-start p-4 border border-zinc-700 rounded-lg bg-zinc-950/50 min-h-[320px]"
      >
        ${currentPattern.map((section) => {
      const slotsBefore = totalSlotsBeforeSection;
      // Calculate slots for the entire section
      const slotsInSection = section.measures.reduce((acc, measure) => {
        const [beats, beatType] = section.timeSignature.split("/").map(Number);
        return acc + beats * (beatType === 8 ? 2 : 4);
      }, 0);
      totalSlotsBeforeSection += slotsInSection; // Update running total

      return renderSection(
        section,
        chordsMap,
        activeSlot,
        activeBeat,
        slotsBefore, // Pass the total index where this section starts
      );
    })}
        <button
          class="${secondaryButtonClasses} h-full flex-shrink-0 self-stretch"
          @click=${() => {
      appActor.send({
        type: "ADD_SECTION"
      });
    }}
        >
          + Add Section
        </button>
      </div>
    </div>
  `;
};
