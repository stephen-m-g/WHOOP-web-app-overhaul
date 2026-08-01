"use client";

import type { ComponentProps } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { RecoveryTrendPoint } from "@/lib/recovery-stats";
import { RECOVERY_ZONE_COLOR, recoveryZone } from "@/lib/recovery-zones";
import { formatShortDate } from "@/lib/date";

interface RecoveryTrendScatterChartProps {
  points: RecoveryTrendPoint[];
  averageScore: number | null;
}

// The same red/yellow/green triad used for zone classification elsewhere,
// reused here as a red -> yellow -> green gradient for the trendline: yellow
// is "flat", sliding toward red/green as the slope steepens either way.
const RED_RGB: [number, number, number] = [193, 39, 61]; // --metric-recovery-low
const YELLOW_RGB: [number, number, number] = [245, 196, 0]; // --metric-recovery-mid
const GREEN_RGB: [number, number, number] = [25, 236, 5]; // --metric-recovery-high
const ZONE_RGB: Record<"low" | "mid" | "high", [number, number, number]> = {
  low: RED_RGB,
  mid: YELLOW_RGB,
  high: GREEN_RGB,
};

// A ±20-point swing in recovery score over the visible period maxes out the gradient.
const SLOPE_SCALE = 20;
// How much the average-recovery zone tints the slope-driven color, vs. pure slope.
const AVERAGE_WEIGHT = 0.3;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function rgbToCss([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/**
 * Trendline color: primarily driven by the slope's direction/steepness
 * (red = declining, yellow = flat, green = improving), then nudged toward
 * the average recovery score's own zone color, so an improving trend from
 * an already-poor baseline still reads a little more cautious, and vice versa.
 */
function trendlineColor(slope: number, pointCount: number, averageScore: number | null): string {
  const totalChange = slope * (pointCount - 1);
  const t = Math.max(-1, Math.min(1, totalChange / SLOPE_SCALE));
  const slopeRgb = t < 0 ? lerpRgb(YELLOW_RGB, RED_RGB, -t) : lerpRgb(YELLOW_RGB, GREEN_RGB, t);

  if (averageScore == null) return rgbToCss(slopeRgb);

  const zoneRgb = ZONE_RGB[recoveryZone(averageScore)];
  return rgbToCss(lerpRgb(slopeRgb, zoneRgb, AVERAGE_WEIGHT));
}

const chartConfig = {
  score: { label: "Recovery" },
} satisfies ChartConfig;

interface ZoneDotProps {
  cx?: number;
  cy?: number;
  payload?: RecoveryTrendPoint;
}

function ZoneDot({ cx, cy, payload }: ZoneDotProps) {
  if (cx == null || cy == null || !payload) return null;
  return <circle cx={cx} cy={cy} r={2.5} fill={RECOVERY_ZONE_COLOR[payload.zone]} stroke="none" />;
}

/** Simple least-squares fit over the point index — good enough for a straight trendline, nothing fancier. */
function linearRegression(values: number[]): { slope: number; intercept: number } | null {
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

/** Hides the trendline series from the shared tooltip — only the actual recovery score should show there. */
function FilteredTooltipContent(props: ComponentProps<typeof ChartTooltipContent>) {
  return <ChartTooltipContent {...props} payload={props.payload?.filter((item) => item.dataKey !== "trend")} />;
}

export function RecoveryTrendScatterChart({ points, averageScore }: RecoveryTrendScatterChartProps) {
  const tickInterval = Math.ceil(points.length / 10);
  const regression = linearRegression(points.map((p) => p.score));
  const data = points.map((p, i) => ({
    ...p,
    trend: regression ? regression.slope * i + regression.intercept : undefined,
  }));
  const trendColor = regression ? trendlineColor(regression.slope, points.length, averageScore) : undefined;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <LineChart data={data}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => formatShortDate(value)}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={tickInterval}
        />
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={44}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ChartTooltip
          content={
            <FilteredTooltipContent
              labelFormatter={(value) => formatShortDate(String(value))}
              formatter={(value, _name, item) => {
                const point = item.payload as RecoveryTrendPoint;
                return (
                  <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                    <span className="text-muted-foreground">Recovery</span>
                    <span
                      className="font-mono font-medium tabular-nums"
                      style={{ color: RECOVERY_ZONE_COLOR[point.zone] }}
                    >
                      {String(value)}%
                    </span>
                  </div>
                );
              }}
            />
          }
        />
        <Line
          dataKey="score"
          stroke="var(--border)"
          strokeWidth={1}
          dot={<ZoneDot />}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
        {regression && (
          <Line dataKey="trend" stroke={trendColor} strokeWidth={2} dot={false} isAnimationActive={false} />
        )}
      </LineChart>
    </ChartContainer>
  );
}
