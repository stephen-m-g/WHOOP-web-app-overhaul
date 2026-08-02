"use client";

import { useState } from "react";
import { ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { KeyframeAnalysis, KeyframeStageType } from "@/lib/api";

interface KeyframeStage {
  key: KeyframeStageType;
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

const CONCERN_LABELS: Record<string, string> = {
  knee_valgus: "Knees caving inward",
  excessive_torso_lean: "Excessive torso lean",
  shallow_counter_movement: "Shallow counter-movement",
  incomplete_leg_extension: "Incomplete leg extension",
  stiff_landing: "Stiff landing",
};

// Shown only if a specific stage genuinely has no data for it (e.g. that
// frame wasn't detected in the source video).
const NO_DATA_FEEDBACK = "No data available for this stage in this recording.";

interface KeyFrameAnalysisProps {
  keyframeAnalyses: KeyframeAnalysis[];
}

/**
 * Tabs through the 6 stages of a jump, each showing its captured frame
 * alongside coaching feedback for that moment. Replaces the old flat
 * "Coaching Feedback" paragraph + debug-mode toggle.
 */
export function KeyFrameAnalysis({ keyframeAnalyses }: KeyFrameAnalysisProps) {
  const [active, setActive] = useState<KeyframeStageType>(STAGES[0].key);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const activeStage = STAGES.find((stage) => stage.key === active) ?? STAGES[0];
  const activeAnalysis = keyframeAnalyses.find((kf) => kf.type === active);
  const imageSrc = activeAnalysis?.image_b64 ? `data:image/jpeg;base64,${activeAnalysis.image_b64}` : null;

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

      <div className="flex gap-4">
        {imageSrc ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="group relative h-[300px] w-[300px] shrink-0 cursor-zoom-in overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- base64 frame data, not a static asset Next can optimize */}
            <img src={imageSrc} alt={`${activeStage.label} frame`} className="h-full w-full object-contain" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
              <ZoomIn className="size-7 text-white opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </span>
          </button>
        ) : (
          <div className="flex h-[200px] w-[200px] shrink-0 items-center justify-center rounded-lg border border-dashed border-foreground/20 text-center text-xs text-muted-foreground">
            Image unavailable
          </div>
        )}
        <div className="flex flex-1 flex-col gap-3">
          <p className="text-xs text-muted-foreground">{activeStage.description}</p>
          <div>
            <p className="mb-1.5 text-sm font-bold">Feedback:</p>
            <p className="text-sm text-muted-foreground">{activeAnalysis?.feedback ?? NO_DATA_FEEDBACK}</p>
          </div>
          {activeAnalysis && activeAnalysis.metrics.concerns.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeAnalysis.metrics.concerns.map((concern) => (
                <span
                  key={concern}
                  className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 ring-1 ring-amber-500/30 dark:text-amber-400"
                >
                  {CONCERN_LABELS[concern] ?? concern}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-3xl sm:max-w-3xl">
          <DialogTitle className="sr-only">{activeStage.label} frame, enlarged</DialogTitle>
          {imageSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- base64 frame data, not a static asset Next can optimize
            <img
              src={imageSrc}
              alt={`${activeStage.label} frame, enlarged`}
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
