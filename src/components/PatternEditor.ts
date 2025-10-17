// src/components/PatternEditor.ts
import { html } from "lit-html";
import { appActor } from "../client";
import { baseInputClasses } from "./styles";

export const PatternEditor = (currentPattern: string) => html`<textarea
  class="${baseInputClasses} min-h-[240px] font-mono text-base resize-y w-full"
  .value=${currentPattern}
  @input=${(e: Event) =>
    appActor.send({
      type: "UPDATE_PATTERN",
      value: (e.target as HTMLTextAreaElement).value,
    })}
  placeholder='[
  { "time": "0:0", "note": "C4", "duration": "8n" },
  { "time": "0:0", "note": "E4", "duration": "8n" }
]'
></textarea>`;
