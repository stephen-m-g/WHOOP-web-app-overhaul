import Link from "next/link";

type GaugeColorMode = "sleep" | "recovery" | "strain";

interface CircularGaugeProps {
  label: string;
  value: number | null;
  max?: number;
  colorMode: GaugeColorMode;
  formatValue?: (value: number) => string;
  href?: string;
  size?: number;
}

const RECOVERY_ZONES = [
  { max: 33, color: "var(--metric-recovery-low)" },
  { max: 66, color: "var(--metric-recovery-mid)" },
  { max: 100, color: "var(--metric-recovery-high)" },
];

const DEFAULT_MAX: Record<GaugeColorMode, number> = {
  sleep: 100,
  recovery: 100,
  strain: 21,
};

function resolveColor(colorMode: GaugeColorMode, value: number): string {
  if (colorMode === "sleep") return "var(--metric-sleep)";
  if (colorMode === "strain") return "var(--metric-strain)";
  const zone = RECOVERY_ZONES.find((z) => value <= z.max) ?? RECOVERY_ZONES[RECOVERY_ZONES.length - 1];
  return zone.color;
}

export function CircularGauge({
  label,
  value,
  max,
  colorMode,
  formatValue,
  href,
  size = 96,
}: CircularGaugeProps) {
  const resolvedMax = max ?? DEFAULT_MAX[colorMode];
  const strokeWidth = 7.5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = value !== null ? Math.min(Math.max(value, 0), resolvedMax) / resolvedMax : 0;
  const offset = circumference * (1 - progress);
  const color = value !== null ? resolveColor(colorMode, value) : "var(--muted-foreground)";
  const displayValue = value === null ? "—" : (formatValue ?? ((v: number) => `${Math.round(v)}%`))(value);

  const gauge = (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
          {value !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-stat text-2xl font-semibold tabular-nums">{displayValue}</span>
        </div>
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-block cursor-pointer rounded-lg transition-[transform,opacity] duration-200 ease-out hover:scale-105 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`${label}: ${displayValue}. View details.`}
      >
        {gauge}
      </Link>
    );
  }

  return gauge;
}
