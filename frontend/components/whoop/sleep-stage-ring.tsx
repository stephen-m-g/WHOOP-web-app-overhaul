interface StageSegment {
  label: string;
  /** Proportional weight for the arc — any consistent unit (e.g. milliseconds) works. */
  value: number;
  color: string;
}

interface SleepStageRingProps {
  segments: StageSegment[];
  centerLabel: string;
  centerValue: string;
  size?: number;
}

export function SleepStageRing({ segments, centerLabel, centerValue, size = 140 }: SleepStageRingProps) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  const { arcs } = segments.reduce<{
    cumulative: number;
    arcs: Array<StageSegment & { length: number; dashoffset: number }>;
  }>(
    (acc, segment) => {
      const length = (segment.value / total) * circumference;
      const dashoffset = -acc.cumulative;
      return { cumulative: acc.cumulative + length, arcs: [...acc.arcs, { ...segment, length, dashoffset }] };
    },
    { cumulative: 0, arcs: [] },
  );

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.length} ${circumference - arc.length}`}
            strokeDashoffset={arc.dashoffset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted-foreground">{centerLabel}</span>
        <span className="font-stat text-xl font-semibold tabular-nums">{centerValue}</span>
      </div>
    </div>
  );
}
