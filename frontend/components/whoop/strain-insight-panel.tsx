"use client";

import { useState } from "react";
import type { WorkoutRecord } from "@/lib/whoop";
import { formatDuration } from "@/lib/date";
import { cn } from "@/lib/utils";

interface StrainInsightPanelProps {
  dayStrain: number | null;
  workouts: WorkoutRecord[];
}

interface ActivityOption {
  key: string;
  label: string;
  strain: number | null;
  maxHr: number | null;
  avgHr: number | null;
  calories: number | null;
  durationMilli: number | null;
}

const KILOJOULES_PER_KCAL = 4.184;

export function StrainInsightPanel({ dayStrain, workouts }: StrainInsightPanelProps) {
  const options: ActivityOption[] = [
    { key: "day", label: "Day", strain: dayStrain, maxHr: null, avgHr: null, calories: null, durationMilli: null },
    ...workouts.map((workout, index) => ({
      key: workout.id || String(index),
      label: workout.sport_name ?? "Activity",
      strain: workout.score?.strain ?? null,
      maxHr: workout.score?.max_heart_rate ?? null,
      avgHr: workout.score?.average_heart_rate ?? null,
      calories: workout.score?.kilojoule != null ? Math.round(workout.score.kilojoule / KILOJOULES_PER_KCAL) : null,
      durationMilli: new Date(workout.end).getTime() - new Date(workout.start).getTime(),
    })),
  ];

  const [selectedKey, setSelectedKey] = useState(options[0]?.key ?? "day");
  const selected = options.find((option) => option.key === selectedKey) ?? options[0];

  if (!selected) {
    return <p className="text-sm text-muted-foreground">No activity data recorded for this day.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setSelectedKey(option.key)}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              option.key === selectedKey
                ? "bg-metric-strain text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            {option.strain != null && <span className="ml-1.5 tabular-nums">{option.strain.toFixed(1)}</span>}
          </button>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Max HR</dt>
          <dd className="font-stat text-lg font-semibold tabular-nums">{selected.maxHr ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Average HR</dt>
          <dd className="font-stat text-lg font-semibold tabular-nums">{selected.avgHr ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Calories</dt>
          <dd className="font-stat text-lg font-semibold tabular-nums">{selected.calories ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Duration</dt>
          <dd className="font-stat text-lg font-semibold tabular-nums">
            {selected.durationMilli != null ? formatDuration(selected.durationMilli) : "—"}
          </dd>
        </div>
      </dl>

      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
        Heart rate graph — coming soon
      </div>
    </div>
  );
}
