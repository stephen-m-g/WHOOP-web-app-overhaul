import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RecoveryRangeSelector, type RecoveryRange } from "@/components/whoop/recovery-range-selector";
import { RecoveryTrendBarChart } from "@/components/whoop/recovery-trend-bar-chart";
import { RecoveryTrendScatterChart } from "@/components/whoop/recovery-trend-scatter-chart";
import { RecoveryRippleBackground } from "@/components/whoop/recovery-ripple-background";
import { getSession } from "@/lib/auth";
import { getRecovery, type RecoveryRecord } from "@/lib/whoop";
import { rangeSpan, toDateKey } from "@/lib/date";
import { averageRecoveryScore, buildRecoveryStats, buildRecoveryTrendPoints } from "@/lib/recovery-stats";
import { cn, GLASS_CARD } from "@/lib/utils";

const RANGE_DAYS: Record<RecoveryRange, number> = {
  week: 7,
  "2weeks": 14,
  month: 30,
  "3months": 90,
  "6months": 180,
};

function isRecoveryRange(value: string | undefined): value is RecoveryRange {
  return value === "week" || value === "2weeks" || value === "month" || value === "3months" || value === "6months";
}

export default async function RecoveryPage({
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
        <p className="text-muted-foreground">Connect from the dashboard to see recovery insights here.</p>
        <Link href="/dashboard" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const date = dateParam ?? toDateKey(new Date());
  const range: RecoveryRange = isRecoveryRange(rangeParam) ? rangeParam : "week";
  const days = RANGE_DAYS[range];

  const { start, end } = rangeSpan(date, days);
  const fetchLimit = days + 10;

  let records: RecoveryRecord[] = [];
  try {
    const result = await getRecovery(session.accessToken, { start, end, limit: fetchLimit });
    records = result.records;
  } catch (error) {
    console.error("Failed to load recovery data", error);
  }

  const stats = buildRecoveryStats(records);
  const trendPoints = buildRecoveryTrendPoints(records);
  const averageScore = averageRecoveryScore(records);
  const isScatter = range === "3months" || range === "6months";

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col justify-center px-4 py-12">
      <RecoveryRippleBackground averageScore={averageScore} />
      <div className="animate-intro-fade mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-stat text-3xl font-bold tracking-tight">Recovery</h1>
        <RecoveryRangeSelector date={date} range={range} />
      </div>

      <Card className={cn("animate-intro-fade mb-4 [animation-delay:150ms]", GLASS_CARD)}>
        <CardContent>
          {stats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recovery data recorded for this period.</p>
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
          <h2 className="text-sm font-medium text-muted-foreground">Recovery Trend</h2>
        </CardHeader>
        <CardContent>
          {trendPoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recovery data recorded for this period.</p>
          ) : isScatter ? (
            <RecoveryTrendScatterChart points={trendPoints} averageScore={averageScore} />
          ) : (
            <RecoveryTrendBarChart points={trendPoints} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
