"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { StrainTrendPoint } from "@/lib/strain-stats";
import { formatShortDate } from "@/lib/date";

interface StrainTrendBarChartProps {
  points: StrainTrendPoint[];
}

const chartConfig = {
  strain: { label: "Day Strain", color: "var(--metric-strain)" },
} satisfies ChartConfig;

export function StrainTrendBarChart({ points }: StrainTrendBarChartProps) {
  const tickInterval = points.length > 14 ? Math.ceil(points.length / 10) : 0;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart data={points}>
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
        <Bar dataKey="strain" fill="var(--color-strain)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
