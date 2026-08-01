import type { CycleRecord, WorkoutRecord } from "@/lib/whoop";
import { buildStrainStats, buildWorkoutZoneBreakdown } from "@/lib/strain-stats";
import { WorkoutZoneBar } from "@/components/whoop/workout-zone-bar";

interface StrainInsightPanelProps {
  cycle: CycleRecord | null;
  workouts: WorkoutRecord[];
}

/**
 * Mirrors the strain detail page's "day" view (stats + per-workout HR zone
 * breakdowns) rather than a continuous heart-rate graph — Whoop's public API
 * doesn't expose per-minute HR for workouts, only the zone_durations totals.
 */
export function StrainInsightPanel({ cycle, workouts }: StrainInsightPanelProps) {
  const stats = buildStrainStats(cycle ? [cycle] : []);
  const zoneBreakdowns = workouts.map((workout) => buildWorkoutZoneBreakdown(workout)).filter((breakdown) => breakdown !== null);

  if (stats.length === 0 && zoneBreakdowns.length === 0) {
    return <p className="text-sm text-muted-foreground">No strain data recorded for this day.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {stats.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="font-stat text-lg font-semibold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {zoneBreakdowns.length > 0 && (
        <div className="flex flex-col gap-4">
          {zoneBreakdowns.map((breakdown) => (
            <WorkoutZoneBar key={breakdown.workoutId} breakdown={breakdown} />
          ))}
        </div>
      )}
    </div>
  );
}
