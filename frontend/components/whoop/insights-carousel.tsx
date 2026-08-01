"use client";

import { useState } from "react";
import Link from "next/link";
import { Moon, BatteryCharging, User, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, GLASS_CARD } from "@/lib/utils";
import { SleepInsightPanel } from "@/components/whoop/sleep-insight-panel";
import { RecoveryInsightPanel } from "@/components/whoop/recovery-insight-panel";
import { StrainInsightPanel } from "@/components/whoop/strain-insight-panel";
import type { SleepRecord, RecoveryRecord, CycleRecord, WorkoutRecord } from "@/lib/whoop";

type InsightTab = "sleep" | "recovery" | "strain";

interface InsightsCarouselProps {
  sleep: SleepRecord | null;
  recovery: RecoveryRecord | null;
  sleepPerformance: number | null;
  cycle: CycleRecord | null;
  workouts: WorkoutRecord[];
}

const TABS: Array<{ key: InsightTab; label: string; icon: typeof Moon; color: string; href: string }> = [
  { key: "sleep", label: "Sleep Insights", icon: Moon, color: "var(--metric-sleep)", href: "/sleep" },
  {
    key: "recovery",
    label: "Recovery Insights",
    icon: BatteryCharging,
    color: "var(--metric-recovery-high)",
    href: "/recovery",
  },
  { key: "strain", label: "Strain Insights", icon: User, color: "var(--metric-strain)", href: "/strain" },
];

export function InsightsCarousel({ sleep, recovery, sleepPerformance, cycle, workouts }: InsightsCarouselProps) {
  const [active, setActive] = useState<InsightTab>("sleep");
  const activeTab = TABS.find((tab) => tab.key === active) ?? TABS[0];

  return (
    <Card className={GLASS_CARD}>
      <div className="flex items-center gap-2 px-(--card-spacing)">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              aria-pressed={isActive}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-full py-1.5 pl-1.5 transition-all duration-200",
                isActive ? "bg-muted pr-4" : "pr-1.5 text-muted-foreground hover:opacity-80",
              )}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200"
                style={{ backgroundColor: isActive ? tab.color : "var(--muted)" }}
              >
                <Icon className={cn("size-4", isActive ? "text-white" : "text-muted-foreground")} aria-hidden="true" />
              </span>
              {isActive && <span className="text-sm font-medium text-foreground">{tab.label}</span>}
            </button>
          );
        })}
      </div>

      <div key={active} className="animate-in fade-in-0 px-(--card-spacing) pb-(--card-spacing) duration-300">
        {active === "sleep" && <SleepInsightPanel sleep={sleep} />}
        {active === "recovery" && <RecoveryInsightPanel recovery={recovery} sleepPerformance={sleepPerformance} />}
        {active === "strain" && <StrainInsightPanel cycle={cycle} workouts={workouts} />}

        <div className="mt-4 flex justify-end">
          <Link
            href={activeTab.href}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: activeTab.color }}
          >
            more
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </Card>
  );
}
