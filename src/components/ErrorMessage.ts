// src/components/ErrorMessage.ts
import { html } from "lit-html";

export const ErrorMessage = (errorMessage: string | null) => {
  if (!errorMessage) return html``;
  return html`<div class="container mx-auto p-4 md:p-8 max-w-3xl">
    <div
      class="mt-4 p-4 bg-red-900/20 text-red-400 border border-red-500/50 rounded-md text-sm"
    >
      <strong>Error:</strong> ${errorMessage}
    </div>
  </div>`;
};
