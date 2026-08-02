"use client";

import { useState } from "react";
import Link from "next/link";
import type { JumpRecordSummary, JumpType } from "@/lib/api";
import { filterJumpsByType, formatJumpDate, formatMeasurement, measurementCmFor } from "@/lib/jump-stats";
import { JumpTypeToggle } from "./jump-type-toggle";

interface JumpLogProps {
  jumps: JumpRecordSummary[];
}

export function JumpLog({ jumps }: JumpLogProps) {
  const [jumpType, setJumpType] = useState<JumpType>("vertical");
  const filtered = filterJumpsByType(jumps, jumpType)
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="flex flex-col gap-4">
      <JumpTypeToggle value={jumpType} onChange={setJumpType} />

      <div className="mb-1 grid grid-cols-3 gap-4 text-xs text-muted-foreground">
        <span>date</span>
        <span>type</span>
        <span>measurement</span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No {jumpType} jumps recorded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {filtered.map((jump) => {
            const cm = measurementCmFor(jump);
            return (
              <Link
                key={jump.id}
                href={`/jump-trainer/results/${jump.id}`}
                className="grid grid-cols-3 gap-4 rounded-lg px-2 py-2 text-sm transition-colors -mx-2 hover:bg-muted"
              >
                <span>{formatJumpDate(jump.created_at)}</span>
                <span className="capitalize">{jump.jump_type}</span>
                <span className="font-semibold tabular-nums">{cm != null ? formatMeasurement(cm, "metric") : "N/A"}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
