import type { RecoveryRecord } from "./whoop";
import { toDateKey } from "./date";
import { recoveryZone, type RecoveryZone } from "./recovery-zones";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function scoredRecords(records: RecoveryRecord[]): RecoveryRecord[] {
  return records.filter((r) => r.score_state === "SCORED" && r.score);
}

/** Average recovery score across whatever records are given — drives the background's zone color. */
export function averageRecoveryScore(records: RecoveryRecord[]): number | null {
  return average(scoredRecords(records).map((r) => r.score!.recovery_score));
}

export interface RecoveryStat {
  label: string;
  value: string;
}

/** Computes stats across however many days are given — a single day is just an "average" of one. */
export function buildRecoveryStats(records: RecoveryRecord[]): RecoveryStat[] {
  const scored = scoredRecords(records);

  const numeric = (pick: (r: RecoveryRecord) => number | null | undefined): number[] =>
    scored.map(pick).filter((v): v is number => v != null);

  const score = average(numeric((r) => r.score?.recovery_score));
  const restingHr = average(numeric((r) => r.score?.resting_heart_rate));
  const hrv = average(numeric((r) => r.score?.hrv_rmssd_milli));
  const spo2 = average(numeric((r) => r.score?.spo2_percentage));
  const skinTemp = average(numeric((r) => r.score?.skin_temp_celsius));

  const stats: Array<RecoveryStat | null> = [
    score != null ? { label: "Recovery Score", value: `${Math.round(score)}%` } : null,
    restingHr != null ? { label: "Resting Heart Rate", value: `${Math.round(restingHr)} bpm` } : null,
    hrv != null ? { label: "HRV", value: `${Math.round(hrv)} ms` } : null,
    spo2 != null ? { label: "Blood Oxygen", value: `${spo2.toFixed(1)}%` } : null,
    skinTemp != null ? { label: "Skin Temp", value: `${skinTemp.toFixed(1)}°C` } : null,
  ];

  return stats.filter((s): s is RecoveryStat => s !== null);
}

export interface RecoveryTrendPoint {
  date: string;
  score: number;
  zone: RecoveryZone;
}

/** One point per scored day, oldest first — feeds both the bar and scatter trend charts. */
export function buildRecoveryTrendPoints(records: RecoveryRecord[]): RecoveryTrendPoint[] {
  return scoredRecords(records)
    .map((r) => ({
      date: toDateKey(new Date(r.created_at)),
      score: r.score!.recovery_score,
      zone: recoveryZone(r.score!.recovery_score),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
