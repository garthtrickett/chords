// src/components/PatternEditor.ts
import { html } from "lit-html";
import { appActor } from "../client";
import { baseInputClasses } from "./styles";
import type { PatternSection } from "../../types/app";

export const PatternEditor = (currentPattern: PatternSection[]) => html`<textarea
  class="${baseInputClasses} min-h-[240px] font-mono text-base resize-y w-full"
  .value=${JSON.stringify(currentPattern, null, 2)}
  @input=${(e: Event) => {
    try {
      const value = (e.target as HTMLTextAreaElement).value;
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        appActor.send({
          type: "UPDATE_PATTERN_STRUCTURE",
          value: parsed,
        });
      }
    } catch (error) {
      // Ignore invalid JSON while typing
    }
  }}
  placeholder='[]'
></textarea>`;
