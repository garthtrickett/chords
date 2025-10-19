// src/components/AppShell.ts
import { html } from "lit-html";
import { cardClasses } from "./styles";

export const AppShell = () => html`
  <div class="bg-zinc-950 text-zinc-50 min-h-screen font-sans">
    <div class="container mx-auto p-4 md:p-8">
      <header class="text-center mb-8">
        <h1 class="text-4xl font-bold tracking-tight text-zinc-50">
          Polyphonic Live Coder
        </h1>
        <p class="text-zinc-400 mt-2">
          Create, play, and save polyphonic patterns in real-time.
        </p>
      </header>
      <div class=${cardClasses}>
        <div id="editor-container"></div>
        <div id="controls-container"></div>
      </div>
      <div class="mt-8 ${cardClasses} max-w-3xl mx-auto">
        <div id="loader-container"></div>
      </div>
      <div class="mt-8 ${cardClasses} max-w-3xl mx-auto">
        <div id="chord-bank-container"></div>
      </div>
      <div class="mt-8 ${cardClasses} max-w-3xl mx-auto">
        <div id="tuning-manager-container"></div>
      </div>
    </div>
    <div id="modal-container"></div>
  </div>
`;
