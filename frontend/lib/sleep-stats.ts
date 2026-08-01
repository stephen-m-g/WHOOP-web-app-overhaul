import type { SleepRecord, RecoveryRecord } from "./whoop";
import { formatDuration, toDateKey } from "./date";

export interface NightlySleep {
  sleep: SleepRecord;
  recovery: RecoveryRecord | null;
}

/** Pairs each (non-nap) sleep record with its recovery via the shared sleep_id, oldest first. */
export function pairSleepWithRecovery(sleepRecords: SleepRecord[], recoveryRecords: RecoveryRecord[]): NightlySleep[] {
  const recoveryBySleepId = new Map(recoveryRecords.map((r) => [r.sleep_id, r]));
  return sleepRecords
    .filter((sleep) => !sleep.nap)
    .map((sleep) => ({ sleep, recovery: recoveryBySleepId.get(sleep.id) ?? null }))
    .sort((a, b) => a.sleep.start.localeCompare(b.sleep.start));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface SleepStat {
  label: string;
  value: string;
}

/** Computes stats across however many nights are given — a single night is just an "average" of one. */
export function buildSleepStats(nights: NightlySleep[]): SleepStat[] {
  const isAverage = nights.length > 1;
  const scored = nights.filter((n) => n.sleep.score_state === "SCORED" && n.sleep.score);

  const numeric = (pick: (n: NightlySleep) => number | null | undefined): number[] =>
    scored.map(pick).filter((v): v is number => v != null);

  const performance = average(numeric((n) => n.sleep.score?.sleep_performance_percentage));
  const efficiency = average(numeric((n) => n.sleep.score?.sleep_efficiency_percentage));
  const consistency = average(numeric((n) => n.sleep.score?.sleep_consistency_percentage));
  const respiratoryRate = average(numeric((n) => n.sleep.score?.respiratory_rate));
  const timeInBed = average(numeric((n) => n.sleep.score?.stage_summary.total_in_bed_time_milli));
  const disturbances = average(numeric((n) => n.sleep.score?.stage_summary.disturbance_count));
  const restingHr = average(
    nights.map((n) => n.recovery?.score?.resting_heart_rate).filter((v): v is number => v != null),
  );

  const stats: Array<SleepStat | null> = [
    performance != null ? { label: "Sleep Performance", value: `${Math.round(performance)}%` } : null,
    timeInBed != null ? { label: "Time in Bed", value: formatDuration(timeInBed) } : null,
    efficiency != null ? { label: "Sleep Efficiency", value: `${Math.round(efficiency)}%` } : null,
    consistency != null ? { label: "Sleep Consistency", value: `${Math.round(consistency)}%` } : null,
    restingHr != null ? { label: "Resting Heart Rate", value: `${Math.round(restingHr)} bpm` } : null,
    respiratoryRate != null ? { label: "Respiratory Rate", value: respiratoryRate.toFixed(1) } : null,
    disturbances != null
      ? { label: "Disturbances", value: isAverage ? disturbances.toFixed(1) : String(Math.round(disturbances)) }
      : null,
  ];

  return stats.filter((s): s is SleepStat => s !== null);
}

export interface NightStageBreakdown {
  date: string;
  awakeHours: number;
  lightHours: number;
  remHours: number;
  deepHours: number;
  totalHours: number;
}

/** Per-stage duration (hours) for each scored night — feeds both the single-night bar and the multi-night trend chart. */
export function buildNightlyBreakdowns(nights: NightlySleep[]): NightStageBreakdown[] {
  const MILLI_PER_HOUR = 3_600_000;
  return nights
    .filter((n) => n.sleep.score?.stage_summary)
    .map((n) => {
      const stages = n.sleep.score!.stage_summary;
      return {
        date: toDateKey(new Date(n.sleep.start)),
        awakeHours: stages.total_awake_time_milli / MILLI_PER_HOUR,
        lightHours: stages.total_light_sleep_time_milli / MILLI_PER_HOUR,
        remHours: stages.total_rem_sleep_time_milli / MILLI_PER_HOUR,
        deepHours: stages.total_slow_wave_sleep_time_milli / MILLI_PER_HOUR,
        totalHours: stages.total_in_bed_time_milli / MILLI_PER_HOUR,
      };
    });
}
