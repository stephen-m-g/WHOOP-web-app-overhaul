import type { CycleRecord, WorkoutRecord } from "./whoop";
import { toDateKey } from "./date";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function scoredCycles(cycles: CycleRecord[]): CycleRecord[] {
  return cycles.filter((c) => c.score_state === "SCORED" && c.score);
}

const KILOJOULE_PER_KCAL = 4.184;

export interface StrainStat {
  label: string;
  value: string;
}

/** Computes stats across however many days are given — a single day is just an "average" of one. */
export function buildStrainStats(cycles: CycleRecord[]): StrainStat[] {
  const scored = scoredCycles(cycles);

  const numeric = (pick: (c: CycleRecord) => number | null | undefined): number[] =>
    scored.map(pick).filter((v): v is number => v != null);

  const strain = average(numeric((c) => c.score?.strain));
  const avgHr = average(numeric((c) => c.score?.average_heart_rate));
  const maxHr = average(numeric((c) => c.score?.max_heart_rate));
  const kilojoule = average(numeric((c) => c.score?.kilojoule));

  const stats: Array<StrainStat | null> = [
    strain != null ? { label: "Day Strain", value: strain.toFixed(1) } : null,
    avgHr != null ? { label: "Average Heart Rate", value: `${Math.round(avgHr)} bpm` } : null,
    maxHr != null ? { label: "Max Heart Rate", value: `${Math.round(maxHr)} bpm` } : null,
    kilojoule != null ? { label: "Calories", value: `${Math.round(kilojoule / KILOJOULE_PER_KCAL)} kcal` } : null,
  ];

  return stats.filter((s): s is StrainStat => s !== null);
}

export interface StrainTrendPoint {
  date: string;
  strain: number;
}

/** One point per scored day, oldest first. */
export function buildStrainTrendPoints(cycles: CycleRecord[]): StrainTrendPoint[] {
  return scoredCycles(cycles)
    .map((c) => ({
      date: toDateKey(new Date(c.start)),
      strain: c.score!.strain,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface ZoneSegment {
  key: string;
  label: string;
  hours: number;
}

export interface WorkoutZoneBreakdown {
  workoutId: string;
  sportName: string;
  start: string;
  totalHours: number;
  zones: ZoneSegment[];
}

/**
 * Whoop only exposes a per-zone time breakdown on individual Workouts, not
 * on the Cycle (whole day) — there's no continuous HR curve available at
 * all, so this is the closest real substitute for a "heart rate graph."
 */
export function buildWorkoutZoneBreakdown(workout: WorkoutRecord): WorkoutZoneBreakdown | null {
  const zoneDurations = workout.score?.zone_durations;
  if (!zoneDurations) return null;

  const MILLI_PER_HOUR = 3_600_000;
  const zones: ZoneSegment[] = [
    { key: "zone0", label: "0-49%", hours: zoneDurations.zone_zero_milli / MILLI_PER_HOUR },
    { key: "zone1", label: "50-59%", hours: zoneDurations.zone_one_milli / MILLI_PER_HOUR },
    { key: "zone2", label: "60-69%", hours: zoneDurations.zone_two_milli / MILLI_PER_HOUR },
    { key: "zone3", label: "70-79%", hours: zoneDurations.zone_three_milli / MILLI_PER_HOUR },
    { key: "zone4", label: "80-89%", hours: zoneDurations.zone_four_milli / MILLI_PER_HOUR },
    { key: "zone5", label: "90-100%", hours: zoneDurations.zone_five_milli / MILLI_PER_HOUR },
  ];

  return {
    workoutId: workout.id,
    sportName: workout.sport_name ?? "Activity",
    start: workout.start,
    totalHours: zones.reduce((sum, z) => sum + z.hours, 0),
    zones,
  };
}
