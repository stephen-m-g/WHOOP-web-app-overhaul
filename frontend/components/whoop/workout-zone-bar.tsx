"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatHours } from "@/lib/date";
import type { WorkoutZoneBreakdown } from "@/lib/strain-stats";

interface WorkoutZoneBarProps {
  breakdown: WorkoutZoneBreakdown;
}

// A light-to-deep tint of the WHOOP accent blue, one shade per zone —
// zone 0 (least intense) is a pale tint, zone 5 (90-100% of max) is the
// full, saturated accent color.
const ZONE_RGB: [number, number, number][] = [
  [199, 229, 250],
  [153, 209, 248],
  [107, 189, 246],
  [61, 169, 240],
  [15, 149, 233],
  [1, 118, 191],
];

function zoneColor(index: number): string {
  const [r, g, b] = ZONE_RGB[index];
  return `rgb(${r}, ${g}, ${b})`;
}

function formatStartTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** One workout's time-in-each-HR-zone breakdown, as a proportional horizontal bar. */
export function WorkoutZoneBar({ breakdown }: WorkoutZoneBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium capitalize text-foreground">{breakdown.sportName}</span>
        <span className="text-xs text-muted-foreground">
          {formatStartTime(breakdown.start)} · {formatHours(breakdown.totalHours)}
        </span>
      </div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
        {breakdown.zones.map((zone, index) => {
          if (zone.hours <= 0 || breakdown.totalHours <= 0) return null;
          const percent = (zone.hours / breakdown.totalHours) * 100;
          return (
            <Tooltip key={zone.key}>
              <TooltipTrigger
                className="h-full cursor-pointer transition-[filter] duration-150 hover:brightness-110"
                style={{ width: `${percent}%`, backgroundColor: zoneColor(index) }}
                aria-label={`${zone.label} of max: ${formatHours(zone.hours)}`}
              />
              <TooltipContent>
                {zone.label} of max: {formatHours(zone.hours)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
