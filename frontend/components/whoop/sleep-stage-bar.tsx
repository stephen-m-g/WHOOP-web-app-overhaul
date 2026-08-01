"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NightStageBreakdown } from "@/lib/sleep-stats";
import { formatHours } from "@/lib/date";

interface SleepStageBarProps {
  breakdown: NightStageBreakdown;
}

type StageKey = "awakeHours" | "lightHours" | "remHours" | "deepHours";

const STAGES: Array<{ key: StageKey; label: string; color: string }> = [
  { key: "awakeHours", label: "Awake", color: "var(--stage-awake)" },
  { key: "lightHours", label: "Light", color: "var(--stage-light)" },
  { key: "remHours", label: "REM", color: "var(--stage-rem)" },
  { key: "deepHours", label: "Deep", color: "var(--stage-deep)" },
];

/**
 * Proportional stage breakdown for a single night — segments sized by each
 * stage's share of total time in bed. Not a chronological timeline: the
 * Whoop API only exposes per-stage totals, not a per-minute stage sequence,
 * so this deliberately doesn't imply an order stages occurred in.
 */
export function SleepStageBar({ breakdown }: SleepStageBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
        {STAGES.map((stage) => {
          const hours = breakdown[stage.key];
          if (hours <= 0 || breakdown.totalHours <= 0) return null;
          const percent = (hours / breakdown.totalHours) * 100;
          return (
            <Tooltip key={stage.key}>
              <TooltipTrigger
                className="h-full cursor-pointer transition-[filter] duration-150 hover:brightness-110"
                style={{ width: `${percent}%`, backgroundColor: stage.color }}
                aria-label={`${stage.label}: ${formatHours(hours)}`}
              />
              <TooltipContent>
                {stage.label}: {formatHours(hours)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
        {STAGES.map((stage) => (
          <li key={stage.key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden="true" />
            <span className="text-muted-foreground">{stage.label}</span>
            <span className="font-medium tabular-nums">{formatHours(breakdown[stage.key])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
