import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Semi-transparent card treatment so the dashboard's interactive grid background
 * shows through. Lighter blur than a first pass (so the moving grid stays legible
 * through the card rather than smoothing into a flat tint), plus an inset rim —
 * a bright top edge and dark bottom edge — that reads as a glass edge catching
 * light, so the effect still lands even where the background behind a card is calm.
 */
export const GLASS_CARD =
  "bg-card/85 backdrop-blur-md ring-2 ring-white/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),inset_0_-1px_0_0_rgba(0,0,0,0.25)]"
