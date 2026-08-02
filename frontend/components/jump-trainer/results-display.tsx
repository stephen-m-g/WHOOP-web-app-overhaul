"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { KeyFrameAnalysis } from "@/components/jump-trainer/key-frame-analysis";
import type { JumpAnalysisResult, JumpType } from "@/lib/api";
import { formatMeasurement, type MeasurementUnit } from "@/lib/jump-stats";
import { cn, GLASS_CARD } from "@/lib/utils";

interface ResultsDisplayProps {
  jumpType: JumpType;
  result: JumpAnalysisResult;
}

export function ResultsDisplay({ jumpType, result }: ResultsDisplayProps) {
  const [unit, setUnit] = useState<MeasurementUnit>("metric");
  const confidencePct = Math.round(result.analysis_confidence * 100);
  const measurementCm = jumpType === "vertical" ? result.jump_height_cm : result.jump_distance_cm;
  const measurementLabel = jumpType === "vertical" ? "estimated height:" : "estimated distance:";

  return (
    <div className="flex flex-col gap-4">
      {result.camera_warnings.length > 0 && (
        <div className="animate-intro-fade flex flex-col gap-2">
          {result.camera_warnings.map((warning) => (
            <Alert key={warning.code}>
              <TriangleAlert className="text-amber-500" />
              <AlertTitle>Camera setup may have affected this result</AlertTitle>
              <AlertDescription>{warning.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <Card className={cn("animate-intro-fade [animation-delay:150ms]", GLASS_CARD)}>
        <CardContent>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h1 className="text-lg font-bold tracking-tight">
              {jumpType === "vertical" ? "Vertical Jump:" : "Broad Jump:"}
            </h1>
            <span className="text-sm font-semibold text-jump-trainer-accent">{confidencePct}% Confidence</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{measurementLabel}</span>
              <div className="flex items-center gap-1 rounded-full bg-muted p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setUnit("metric")}
                  aria-pressed={unit === "metric"}
                  className={cn(
                    "cursor-pointer rounded-full px-2.5 py-1 transition-colors",
                    unit === "metric" ? "bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  cm
                </button>
                <button
                  type="button"
                  onClick={() => setUnit("imperial")}
                  aria-pressed={unit === "imperial"}
                  className={cn(
                    "cursor-pointer rounded-full px-2.5 py-1 transition-colors",
                    unit === "imperial" ? "bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  in
                </button>
              </div>
            </div>
            <span className="font-stat text-2xl font-bold tabular-nums">
              {measurementCm != null ? formatMeasurement(measurementCm, unit) : "N/A"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className={cn("animate-intro-fade [animation-delay:300ms]", GLASS_CARD)}>
        <CardContent>
          <KeyFrameAnalysis keyframeAnalyses={result.keyframe_analyses} />
        </CardContent>
      </Card>
    </div>
  );
}
