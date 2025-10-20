// src/components/ChordSelectionDialog.ts
import { html, nothing } from "lit-html";
import { appActor } from "../client";
import type { SerializableChord } from "../../types/app";
import {
  cardClasses,
  destructiveButtonClasses,
  secondaryButtonClasses,
} from "./styles";

export const ChordSelectionDialog = (
  paletteChordIds: string[],
  savedChords: SerializableChord[],
  isSlotFilled: boolean,
) => {
  console.log("[ChordSelectionDialog] Rendering dialog.");
  const chordsMap = new Map(savedChords.map((c) => [c.id, c]));
  const chordsInPalette = paletteChordIds
    .map((id) => chordsMap.get(id))
    .filter(Boolean) as SerializableChord[];

  return html`<div
    id="chord-selection-dialog"
    tabindex="-1"
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 focus:outline-none"
    @click=${(e: Event) => {
      if (e.currentTarget === e.target) {
        console.log("[ChordSelectionDialog] Background clicked. Sending CANCEL_CHORD_SELECTION.");
        appActor.send({ type: "CANCEL_CHORD_SELECTION" });
      }
    }}
  >
    <div class="${cardClasses} w-full max-w-md">
      <h3 class="text-lg font-medium mb-4 text-zinc-50">Assign Chord to Slot</h3>
      ${chordsInPalette.length > 0
      ? html`<div class="grid grid-cols-3 gap-2">
            ${chordsInPalette.map(
        (chord) =>
          html`<button
                  class="p-4 text-base bg-zinc-800 hover:bg-zinc-700 rounded text-center"
                  @click=${(e: Event) => {
              e.preventDefault();
              console.log(`[ChordSelectionDialog] Chord button "${chord.name}" clicked. Sending ASSIGN_CHORD_TO_SLOT.`);
              if (chord.id) {
                appActor.send({
                  type: "ASSIGN_CHORD_TO_SLOT",
                  chordId: chord.id,
                });
              }
            }}
                >
                  ${chord.name}
                </button>`,
      )}
          </div>`
      : html`<p class="text-zinc-400 text-center py-4">
            No chords in your palette. Go to the Chord Bank to add some.
          </p>`}
      <div class="mt-6 flex justify-between items-center">
        <div>
          ${isSlotFilled
      ? html`<button
                class=${destructiveButtonClasses}
                @click=${(e: Event) => {
          e.preventDefault();
          console.log("[ChordSelectionDialog] 'Remove Chord' button clicked. Sending CLEAR_SLOT.");
          const snapshot = appActor.getSnapshot();
          const { activeSlot } = snapshot.context;
          if (activeSlot) {
            appActor.send({
              type: "CLEAR_SLOT",
              sectionId: activeSlot.sectionId,
              measureId: activeSlot.measureId,
              slotIndex: activeSlot.slotIndex,
            });
          }
        }}
              >
                Remove Chord
              </button>`
      : nothing}
        </div>
        <button
          class=${secondaryButtonClasses}
          @click=${(e: Event) => {
      e.preventDefault();
      console.log("[ChordSelectionDialog] 'Cancel' button clicked. Sending CANCEL_CHORD_SELECTION.");
      appActor.send({ type: "CANCEL_CHORD_SELECTION" });
    }}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>`;
};
