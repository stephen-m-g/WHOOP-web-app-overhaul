"use client";

import { useState } from "react";
import type { JumpRecordSummary, JumpType } from "@/lib/api";
import { filterJumpsByTimeframe, TIMEFRAME_OPTIONS, type JumpTimeframe, type MeasurementUnit } from "@/lib/jump-stats";
import { cn } from "@/lib/utils";
import { JumpTrendChart } from "./jump-trend-chart";
import { JumpTypeToggle } from "./jump-type-toggle";

interface JumpTrendsSectionProps {
  jumps: JumpRecordSummary[];
}

function TimeframeSelector({ value, onChange }: { value: JumpTimeframe; onChange: (value: JumpTimeframe) => void }) {
  return (
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-muted p-1">
      {TIMEFRAME_OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={cn(
              "cursor-pointer rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function JumpTrendsSection({ jumps }: JumpTrendsSectionProps) {
  const [jumpType, setJumpType] = useState<JumpType>("vertical");
  const [timeframe, setTimeframe] = useState<JumpTimeframe>("month");
  const [unit, setUnit] = useState<MeasurementUnit>("metric");

  const filtered = filterJumpsByTimeframe(jumps, timeframe);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold tracking-tight">Height &amp; Distance Over Time</h1>
        {jumps.length > 0 && <TimeframeSelector value={timeframe} onChange={setTimeframe} />}
      </div>

      {jumps.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No jumps logged yet — once your analyzed jumps are saved, this will chart your vertical
          height and broad distance over time.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <JumpTypeToggle value={jumpType} onChange={setJumpType} />
            <div className="flex items-center gap-1 rounded-full bg-muted p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setUnit("metric")}
                aria-pressed={unit === "metric"}
                className={cn(
                  "cursor-pointer rounded-full px-2.5 py-1 transition-colors",
                  unit === "metric" ? "bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                cm
              </button>
              <button
                type="button"
                onClick={() => setUnit("imperial")}
                aria-pressed={unit === "imperial"}
                className={cn(
                  "cursor-pointer rounded-full px-2.5 py-1 transition-colors",
                  unit === "imperial" ? "bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                in
              </button>
            </div>
          </div>

          <JumpTrendChart jumps={filtered} jumpType={jumpType} unit={unit} />
        </>
      )}
    </div>
  );
}
