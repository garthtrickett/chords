// src/components/VisualEditor.ts
import { html } from "lit-html";
import type { NoteEvent } from "../../types/app";

export const VisualEditor = (
  currentPattern: string,
  notesInKey: string[],
) => {
  let notes: NoteEvent[] = [];
  try {
    const parsed = JSON.parse(currentPattern);
    if (Array.isArray(parsed)) {
      notes = parsed;
    }
  } catch (e) {
    return html`<div
      class="min-h-[240px] p-4 text-red-400 border border-red-500/50 rounded-md"
    >
      Invalid JSON format. Switch to JSON view to fix.
    </div>`;
  }

  return html`<div
    class="space-y-2 p-4 border border-zinc-700 rounded-lg bg-zinc-950/50 min-h-[240px]"
  >
    ${notes.map((note, index) => {
    const noteName = note.note.replace(/[0-9]/g, ""); // e.g., 'C#4' -> 'C#'
    const isInKey = notesInKey.includes(noteName);
    return html`<div
        id="note-${index}"
        class="flex items-center gap-4 p-2 bg-zinc-800 rounded transition-colors duration-75 ${!isInKey
        ? "opacity-40"
        : ""}"
      >
        <span class="font-mono text-cyan-400 w-20">Time: ${note.time}</span
        ><span class="font-mono text-pink-400 w-20">Note: ${note.note}</span
        ><span class="font-mono text-amber-400 w-24"
          >Dur: ${note.duration}</span
        >
      </div>`;
  })}
  </div>`;
};
