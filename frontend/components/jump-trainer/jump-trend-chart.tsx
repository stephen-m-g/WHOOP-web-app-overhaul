"use client";

import type { ComponentProps } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { JumpRecordSummary, JumpType } from "@/lib/api";
import {
  cmToDisplayValue,
  filterJumpsByType,
  formatJumpDate,
  linearRegression,
  measurementCmFor,
  type MeasurementUnit,
} from "@/lib/jump-stats";

interface JumpTrendChartProps {
  jumps: JumpRecordSummary[];
  jumpType: JumpType;
  unit: MeasurementUnit;
}

const chartConfig = {
  value: { label: "Measurement" },
} satisfies ChartConfig;

/** Hides the trendline series from the shared tooltip — only the actual measurement should show there. */
function FilteredTooltipContent(props: ComponentProps<typeof ChartTooltipContent>) {
  return <ChartTooltipContent {...props} payload={props.payload?.filter((item) => item.dataKey !== "trend")} />;
}

export function JumpTrendChart({ jumps, jumpType, unit }: JumpTrendChartProps) {
  const unitLabel = unit === "metric" ? "cm" : "in";
  const metricLabel = jumpType === "vertical" ? "Height" : "Distance";

  const points = filterJumpsByType(jumps, jumpType)
    .map((jump) => {
      const cm = measurementCmFor(jump);
      return cm == null ? null : { date: jump.created_at, value: cmToDisplayValue(cm, unit) };
    })
    .filter((p): p is { date: string; value: number } => p !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (points.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
        No {jumpType} jumps recorded in this period.
      </div>
    );
  }

  const regression = linearRegression(points.map((p) => p.value));
  const data = points.map((p, i) => ({
    ...p,
    trend: regression ? regression.slope * i + regression.intercept : undefined,
  }));

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.2, unit === "metric" ? 2 : 1);
  const yDomain: [number, number] = [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)];

  const tickInterval = Math.ceil(data.length / 10);

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <LineChart data={data}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => formatJumpDate(value)}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={tickInterval}
        />
        <YAxis domain={yDomain} tickLine={false} axisLine={false} tickMargin={8} width={44} />
        <ChartTooltip
          content={
            <FilteredTooltipContent
              labelFormatter={(value) => formatJumpDate(String(value))}
              formatter={(value) => (
                <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                  <span className="text-muted-foreground">{metricLabel}</span>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {Number(value).toFixed(1)} {unitLabel}
                  </span>
                </div>
              )}
            />
          }
        />
        <Line
          dataKey="value"
          stroke="var(--jump-trainer-accent)"
          strokeWidth={1.5}
          dot={{ r: 3, fill: "var(--jump-trainer-accent)", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
        {regression && (
          <Line
            dataKey="trend"
            stroke="var(--muted-foreground)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
        )}
      </LineChart>
    </ChartContainer>
  );
}
