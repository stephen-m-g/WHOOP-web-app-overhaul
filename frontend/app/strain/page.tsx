import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StrainRangeSelector, type StrainRange } from "@/components/whoop/strain-range-selector";
import { StrainTrendBarChart } from "@/components/whoop/strain-trend-bar-chart";
import { StrainTrendScatterChart } from "@/components/whoop/strain-trend-scatter-chart";
import { StrainRippleBackground } from "@/components/whoop/strain-ripple-background";
import { WorkoutZoneBar } from "@/components/whoop/workout-zone-bar";
import { getSession } from "@/lib/auth";
import { getCycles, getWorkouts } from "@/lib/whoop";
import { dayRange, rangeSpan, toDateKey } from "@/lib/date";
import { buildStrainStats, buildStrainTrendPoints, buildWorkoutZoneBreakdown, type StrainStat } from "@/lib/strain-stats";
import { cn, GLASS_CARD } from "@/lib/utils";

const RANGE_DAYS: Record<Exclude<StrainRange, "day">, number> = {
  week: 7,
  "2weeks": 14,
  month: 30,
  "3months": 90,
  "6months": 180,
};

function isStrainRange(value: string | undefined): value is StrainRange {
  return (
    value === "day" ||
    value === "week" ||
    value === "2weeks" ||
    value === "month" ||
    value === "3months" ||
    value === "6months"
  );
}

export default async function StrainPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; range?: string }>;
}) {
  const { date: dateParam, range: rangeParam } = await searchParams;
  const session = await getSession();

  if (!session) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Connect your WHOOP account</h1>
        <p className="text-muted-foreground">Connect from the dashboard to see strain insights here.</p>
        <Link href="/dashboard" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const date = dateParam ?? toDateKey(new Date());
  const range: StrainRange = isStrainRange(rangeParam) ? rangeParam : "day";

  let stats: StrainStat[] = [];
  let secondCardTitle: string;
  let secondCardContent: ReactNode;

  if (range === "day") {
    const { start, end } = dayRange(date);
    let cycles: Awaited<ReturnType<typeof getCycles>>["records"] = [];
    let workouts: Awaited<ReturnType<typeof getWorkouts>>["records"] = [];
    try {
      const [cyclesResult, workoutsResult] = await Promise.all([
        getCycles(session.accessToken, { start, end, limit: 5 }),
        getWorkouts(session.accessToken, { start, end, limit: 20 }),
      ]);
      cycles = cyclesResult.records;
      workouts = workoutsResult.records;
    } catch (error) {
      console.error("Failed to load strain data", error);
    }

    const cycle = cycles[0] ?? null;
    stats = buildStrainStats(cycle ? [cycle] : []);
    const zoneBreakdowns = workouts
      .map((workout) => buildWorkoutZoneBreakdown(workout))
      .filter((breakdown) => breakdown !== null);

    secondCardTitle = "Heart Rate Zones";
    secondCardContent =
      zoneBreakdowns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workouts logged this day.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {zoneBreakdowns.map((breakdown) => (
            <WorkoutZoneBar key={breakdown.workoutId} breakdown={breakdown} />
          ))}
        </div>
      );
  } else {
    const days = RANGE_DAYS[range];
    const { start, end } = rangeSpan(date, days);
    const fetchLimit = days + 10;

    let cycles: Awaited<ReturnType<typeof getCycles>>["records"] = [];
    try {
      const result = await getCycles(session.accessToken, { start, end, limit: fetchLimit });
      cycles = result.records;
    } catch (error) {
      console.error("Failed to load strain data", error);
    }

    stats = buildStrainStats(cycles);
    const trendPoints = buildStrainTrendPoints(cycles);
    const isScatter = range === "3months" || range === "6months";

    secondCardTitle = "Strain Trend";
    secondCardContent =
      trendPoints.length === 0 ? (
        <p className="text-sm text-muted-foreground">No strain data recorded for this period.</p>
      ) : isScatter ? (
        <StrainTrendScatterChart points={trendPoints} />
      ) : (
        <StrainTrendBarChart points={trendPoints} />
      );
  }

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col justify-center px-4 py-12">
      <StrainRippleBackground />
      <div className="animate-intro-fade mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-stat text-3xl font-bold tracking-tight">Strain</h1>
        <StrainRangeSelector date={date} range={range} />
      </div>

      <Card className={cn("animate-intro-fade mb-4 [animation-delay:150ms]", GLASS_CARD)}>
        <CardContent>
          {stats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No strain data recorded for this period.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                  <dd className="font-stat text-xl font-semibold tabular-nums">{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className={cn("animate-intro-fade [animation-delay:300ms]", GLASS_CARD)}>
        <CardHeader>
          <h2 className="text-sm font-medium text-muted-foreground">{secondCardTitle}</h2>
        </CardHeader>
        <CardContent>{secondCardContent}</CardContent>
      </Card>
    </div>
  );
}
