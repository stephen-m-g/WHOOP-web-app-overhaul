import { SleepStageRing } from "@/components/whoop/sleep-stage-ring";
import type { SleepRecord } from "@/lib/whoop";
import { formatDuration } from "@/lib/date";

interface SleepInsightPanelProps {
  sleep: SleepRecord | null;
}

const STAGE_COLORS = {
  awake: "var(--stage-awake)",
  light: "var(--stage-light)",
  rem: "var(--stage-rem)",
  deep: "var(--stage-deep)",
};

export function SleepInsightPanel({ sleep }: SleepInsightPanelProps) {
  const stages = sleep?.score?.stage_summary;

  if (!stages) {
    return <p className="text-sm text-muted-foreground">No sleep data recorded for this day.</p>;
  }

  const score = sleep?.score;

  const segments = [
    { label: "Awake", value: stages.total_awake_time_milli, color: STAGE_COLORS.awake },
    { label: "Light", value: stages.total_light_sleep_time_milli, color: STAGE_COLORS.light },
    { label: "REM", value: stages.total_rem_sleep_time_milli, color: STAGE_COLORS.rem },
    { label: "SWS Deep", value: stages.total_slow_wave_sleep_time_milli, color: STAGE_COLORS.deep },
  ];

  const stats = [
    { label: "Time in Bed", value: formatDuration(stages.total_in_bed_time_milli) },
    { label: "Disturbances", value: String(stages.disturbance_count) },
    score?.sleep_efficiency_percentage != null
      ? { label: "Sleep Efficiency", value: `${Math.round(score.sleep_efficiency_percentage)}%` }
      : null,
    score?.sleep_consistency_percentage != null
      ? { label: "Sleep Consistency", value: `${Math.round(score.sleep_consistency_percentage)}%` }
      : null,
    score?.respiratory_rate != null
      ? { label: "Respiratory Rate", value: score.respiratory_rate.toFixed(1) }
      : null,
  ].filter((stat): stat is { label: string; value: string } => stat !== null);

  return (
    <div className="flex flex-wrap items-center gap-8">
      <div className="flex items-center gap-5">
        <SleepStageRing
          segments={segments}
          centerLabel="Time in Bed"
          centerValue={formatDuration(stages.total_in_bed_time_milli)}
        />
        <ul className="flex flex-col gap-1.5 text-sm">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground">{segment.label}</span>
              <span className="ml-auto pl-4 font-medium tabular-nums">{formatDuration(segment.value)}</span>
            </li>
          ))}
        </ul>
      </div>
      <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="font-stat text-lg font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
