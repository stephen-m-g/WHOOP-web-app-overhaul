"use client";

let lastPosition: { x: number; y: number } | null = null;
let listening = false;

function startListening() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(
    "mousemove",
    (event) => {
      lastPosition = { x: event.clientX, y: event.clientY };
    },
    { passive: true },
  );
}

/**
 * Last known cursor position anywhere in the app. The listener is
 * module-level, not tied to any single page's component lifecycle, so it
 * survives client-side route changes (Link navigation doesn't reload the JS
 * runtime) — a background mounting on a new page can pick up wherever the
 * cursor already was, even if it hasn't moved since arriving on that page.
 * Returns null only if the mouse hasn't moved at all since this tab's JS
 * first loaded.
 */
export function getLastKnownCursorPosition(): { x: number; y: number } | null {
  startListening();
  return lastPosition;
}
