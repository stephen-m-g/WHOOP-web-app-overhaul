"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface KeyframeStage {
  key: string;
  label: string;
  description: string;
}

const STAGES: KeyframeStage[] = [
  { key: "initiation", label: "Initiation", description: "The upright standing position right before the jump begins." },
  {
    key: "max_anticipation",
    label: "Max Anticipation",
    description: "The lowest point of the counter-movement dip, right before driving upward.",
  },
  { key: "takeoff", label: "Takeoff", description: "The last instant the feet are still in contact with the ground." },
  { key: "peak", label: "Peak", description: "The highest point reached during the jump." },
  { key: "touchdown", label: "Touchdown", description: "The first instant the feet make contact with the ground again." },
  {
    key: "max_absorption",
    label: "Max Absorption",
    description: "The point of deepest knee bend while absorbing the landing.",
  },
];

// Real per-stage frame images and coaching feedback need either a computer
// vision pass over the video or a reasoning model looking at each frame —
// neither is wired up yet. This is placeholder content so the design can be
// reviewed independent of that work.
const PLACEHOLDER_FEEDBACK = "Feedback for this stage will appear here once form analysis is built out.";

/**
 * Tabs through the 6 stages of a jump, each showing its captured frame
 * (currently a placeholder) alongside coaching feedback for that moment.
 * Replaces the old flat "Coaching Feedback" paragraph + debug-mode toggle —
 * this is meant to surface the same kind of detail the debug overlay used
 * to, without a separate hidden mode.
 */
export function KeyFrameAnalysis() {
  const [active, setActive] = useState(STAGES[0].key);
  const activeStage = STAGES.find((stage) => stage.key === active) ?? STAGES[0];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold tracking-tight">Key Frame Analysis</h2>

      <div className="flex flex-wrap gap-2">
        {STAGES.map((stage) => {
          const isActive = stage.key === active;
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => setActive(stage.key)}
              aria-pressed={isActive}
              className={cn(
                "cursor-pointer rounded-full px-3.5 py-1.5 text-sm ring-1 transition-colors",
                isActive
                  ? "bg-jump-trainer-accent font-semibold text-white ring-jump-trainer-accent"
                  : "font-normal text-muted-foreground ring-foreground/15 hover:text-foreground",
              )}
            >
              {stage.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-foreground/20 text-sm text-muted-foreground">
          Image placeholder
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{activeStage.description}</p>
          <div>
            <p className="mb-1.5 text-sm font-bold">Feedback:</p>
            <p className="text-sm text-muted-foreground">{PLACEHOLDER_FEEDBACK}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
