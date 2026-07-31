import type { RecoveryRecord } from "@/lib/whoop";

interface RecoveryInsightPanelProps {
  recovery: RecoveryRecord | null;
  sleepPerformance: number | null;
}

export function RecoveryInsightPanel({ recovery, sleepPerformance }: RecoveryInsightPanelProps) {
  const score = recovery?.score;

  if (!score) {
    return <p className="text-sm text-muted-foreground">No recovery data recorded for this day.</p>;
  }

  const stats = [
    { label: "HRV", value: `${score.hrv_rmssd_milli.toFixed(0)} ms` },
    { label: "Resting Heart Rate", value: `${Math.round(score.resting_heart_rate)} bpm` },
    sleepPerformance != null ? { label: "Sleep Performance", value: `${Math.round(sleepPerformance)}%` } : null,
  ].filter((stat): stat is { label: string; value: string } => stat !== null);

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="font-stat text-2xl font-semibold tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
