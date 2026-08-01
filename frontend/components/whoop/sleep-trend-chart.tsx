"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { NightStageBreakdown } from "@/lib/sleep-stats";
import { formatHours, formatShortDate } from "@/lib/date";

interface SleepTrendChartProps {
  dateKeys: string[];
  breakdowns: NightStageBreakdown[];
}

const chartConfig = {
  awakeHours: { label: "Awake", color: "var(--stage-awake)" },
  lightHours: { label: "Light", color: "var(--stage-light)" },
  remHours: { label: "REM", color: "var(--stage-rem)" },
  deepHours: { label: "Deep", color: "var(--stage-deep)" },
} satisfies ChartConfig;

export function SleepTrendChart({ dateKeys, breakdowns }: SleepTrendChartProps) {
  const byDate = new Map(breakdowns.map((b) => [b.date, b]));
  const data = dateKeys.map((date) => {
    const breakdown = byDate.get(date);
    return {
      date,
      awakeHours: breakdown?.awakeHours ?? 0,
      lightHours: breakdown?.lightHours ?? 0,
      remHours: breakdown?.remHours ?? 0,
      deepHours: breakdown?.deepHours ?? 0,
    };
  });

  const tickInterval = dateKeys.length > 14 ? Math.ceil(dateKeys.length / 10) : 0;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart data={data} barCategoryGap={dateKeys.length > 14 ? "10%" : "25%"}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => formatShortDate(value)}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={tickInterval}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} tickFormatter={(v: number) => `${v}h`} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatShortDate(String(value))}
              formatter={(value, _name, item) => {
                const stage = chartConfig[item.dataKey as keyof typeof chartConfig];
                return (
                  <>
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: stage?.color }}
                      aria-hidden="true"
                    />
                    <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                      <span className="text-muted-foreground">{stage?.label}</span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {formatHours(Number(value))}
                      </span>
                    </div>
                  </>
                );
              }}
            />
          }
        />
        <Bar dataKey="awakeHours" stackId="stage" fill="var(--color-awakeHours)" />
        <Bar dataKey="lightHours" stackId="stage" fill="var(--color-lightHours)" />
        <Bar dataKey="remHours" stackId="stage" fill="var(--color-remHours)" />
        <Bar dataKey="deepHours" stackId="stage" fill="var(--color-deepHours)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
