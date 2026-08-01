import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SleepRangeSelector, type SleepRange } from "@/components/whoop/sleep-range-selector";
import { SleepStageBar } from "@/components/whoop/sleep-stage-bar";
import { SleepTrendChart } from "@/components/whoop/sleep-trend-chart";
import { SleepRippleBackground } from "@/components/whoop/sleep-ripple-background";
import { getSession } from "@/lib/auth";
import { getRecovery, getSleep } from "@/lib/whoop";
import { dateKeysInRange, dayRange, rangeSpan, toDateKey } from "@/lib/date";
import { buildNightlyBreakdowns, buildSleepStats, pairSleepWithRecovery } from "@/lib/sleep-stats";
import { cn, GLASS_CARD } from "@/lib/utils";

const RANGE_DAYS: Record<SleepRange, number> = {
  day: 1,
  week: 7,
  "2weeks": 14,
  month: 30,
};

function isSleepRange(value: string | undefined): value is SleepRange {
  return value === "day" || value === "week" || value === "2weeks" || value === "month";
}

export default async function SleepPage({
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
        <p className="text-muted-foreground">Connect from the dashboard to see sleep insights here.</p>
        <Link href="/dashboard" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const date = dateParam ?? toDateKey(new Date());
  const range: SleepRange = isSleepRange(rangeParam) ? rangeParam : "day";
  const days = RANGE_DAYS[range];

  const { start, end } = days === 1 ? dayRange(date) : rangeSpan(date, days);
  const fetchLimit = days * 2 + 5;

  const [sleepResult, recoveryResult] = await Promise.allSettled([
    getSleep(session.accessToken, { start, end, limit: fetchLimit }),
    getRecovery(session.accessToken, { start, end, limit: fetchLimit }),
  ]);

  if (sleepResult.status === "rejected") {
    console.error("Failed to load sleep data", sleepResult.reason);
  }
  if (recoveryResult.status === "rejected") {
    console.error("Failed to load recovery data", recoveryResult.reason);
  }

  const sleepRecords = sleepResult.status === "fulfilled" ? sleepResult.value.records : [];
  const recoveryRecords = recoveryResult.status === "fulfilled" ? recoveryResult.value.records : [];

  const nights = pairSleepWithRecovery(sleepRecords, recoveryRecords);
  const stats = buildSleepStats(nights);
  const breakdowns = buildNightlyBreakdowns(nights);

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col justify-center px-4 py-12">
      <SleepRippleBackground />
      <div className="animate-intro-fade mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-stat text-3xl font-bold tracking-tight">Sleep</h1>
        <SleepRangeSelector date={date} range={range} />
      </div>

      <Card className={cn("animate-intro-fade mb-4 [animation-delay:150ms]", GLASS_CARD)}>
        <CardContent>
          {stats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sleep data recorded for this period.</p>
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
          <h2 className="text-sm font-medium text-muted-foreground">
            {range === "day" ? "Sleep Stages" : "Sleep Stages by Night"}
          </h2>
        </CardHeader>
        <CardContent>
          {range === "day" ? (
            breakdowns[0] ? (
              <SleepStageBar breakdown={breakdowns[0]} />
            ) : (
              <p className="text-sm text-muted-foreground">No sleep data recorded for this day.</p>
            )
          ) : (
            <SleepTrendChart dateKeys={dateKeysInRange(date, days)} breakdowns={breakdowns} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
