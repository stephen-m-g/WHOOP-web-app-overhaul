"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { StrainTrendPoint } from "@/lib/strain-stats";
import { formatShortDate } from "@/lib/date";

interface StrainTrendScatterChartProps {
  points: StrainTrendPoint[];
}

const chartConfig = {
  strain: { label: "Day Strain", color: "var(--metric-strain)" },
} satisfies ChartConfig;

export function StrainTrendScatterChart({ points }: StrainTrendScatterChartProps) {
  const tickInterval = Math.ceil(points.length / 10);

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <LineChart data={points}>
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
          domain={[0, 21]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={32}
          tickFormatter={(v: number) => v.toFixed(0)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatShortDate(String(value))}
              formatter={(value) => (
                <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                  <span className="text-muted-foreground">Day Strain</span>
                  <span className="font-mono font-medium tabular-nums" style={{ color: "var(--metric-strain)" }}>
                    {Number(value).toFixed(1)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Line
          dataKey="strain"
          stroke="var(--color-strain)"
          strokeWidth={2}
          dot={{ r: 2.5, fill: "var(--color-strain)", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
