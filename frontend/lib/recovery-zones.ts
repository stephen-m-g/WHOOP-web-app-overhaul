export type RecoveryZone = "low" | "mid" | "high";

export function recoveryZone(score: number): RecoveryZone {
  if (score <= 33) return "low";
  if (score <= 66) return "mid";
  return "high";
}

export const RECOVERY_ZONE_COLOR: Record<RecoveryZone, string> = {
  low: "var(--metric-recovery-low)",
  mid: "var(--metric-recovery-mid)",
  high: "var(--metric-recovery-high)",
};
