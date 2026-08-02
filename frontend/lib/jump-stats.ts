import type { JumpRecordSummary, JumpType } from "./api";

export type MeasurementUnit = "metric" | "imperial";

const CM_PER_INCH = 2.54;

export function cmToDisplayValue(cm: number, unit: MeasurementUnit): number {
  return unit === "metric" ? cm : cm / CM_PER_INCH;
}

export function formatMeasurement(cm: number, unit: MeasurementUnit): string {
  return unit === "metric" ? `${cm} cm` : `${(cm / CM_PER_INCH).toFixed(1)} in`;
}

export function formatJumpDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type JumpTimeframe = "week" | "month" | "3months" | "6months" | "all";

export const TIMEFRAME_OPTIONS: Array<{ value: JumpTimeframe; label: string }> = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "3months", label: "3 Months" },
  { value: "6months", label: "6 Months" },
  { value: "all", label: "All Time" },
];

const TIMEFRAME_DAYS: Record<JumpTimeframe, number | null> = {
  week: 7,
  month: 30,
  "3months": 90,
  "6months": 180,
  all: null,
};

export function filterJumpsByTimeframe(jumps: JumpRecordSummary[], timeframe: JumpTimeframe): JumpRecordSummary[] {
  const days = TIMEFRAME_DAYS[timeframe];
  if (days == null) return jumps;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return jumps.filter((jump) => new Date(jump.created_at).getTime() >= cutoff);
}

export function filterJumpsByType(jumps: JumpRecordSummary[], jumpType: JumpType): JumpRecordSummary[] {
  return jumps.filter((jump) => jump.jump_type === jumpType);
}

export function measurementCmFor(jump: JumpRecordSummary): number | null {
  return jump.jump_type === "vertical" ? jump.jump_height_cm : jump.jump_distance_cm;
}

interface LinearRegressionResult {
  slope: number;
  intercept: number;
}

/** Simple least-squares fit over the point index — good enough for a straight trendline. */
export function linearRegression(values: number[]): LinearRegressionResult | null {
  const n = values.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}
