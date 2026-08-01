"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { RecoveryTrendPoint } from "@/lib/recovery-stats";
import { RECOVERY_ZONE_COLOR } from "@/lib/recovery-zones";
import { formatShortDate } from "@/lib/date";

interface RecoveryTrendBarChartProps {
  points: RecoveryTrendPoint[];
}

const chartConfig = {
  score: { label: "Recovery" },
} satisfies ChartConfig;

export function RecoveryTrendBarChart({ points }: RecoveryTrendBarChartProps) {
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
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={44}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
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
        <Bar dataKey="score" radius={[3, 3, 0, 0]}>
          {points.map((point) => (
            <Cell key={point.date} fill={RECOVERY_ZONE_COLOR[point.zone]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
