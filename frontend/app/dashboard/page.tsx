import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InteractiveGridBackground } from "@/components/whoop/interactive-grid-background";
import { WelcomeBanner } from "@/components/whoop/welcome-banner";
import { DateSelector, type DayActivity } from "@/components/whoop/date-selector";
import { AtAGlanceStats } from "@/components/whoop/at-a-glance-stats";
import { InsightsCarousel } from "@/components/whoop/insights-carousel";
import { getSession } from "@/lib/auth";
import { getRecovery, getSleep, getWorkouts, getCycles, getProfile } from "@/lib/whoop";
import type { RecoveryRecord, SleepRecord, WorkoutRecord, CycleRecord } from "@/lib/whoop";
import { dayRange, addDays, formatDuration, toDateKey } from "@/lib/date";
import { generateInsight } from "@/lib/insight";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Your login session expired or was tampered with. Please try connecting again.",
  token_exchange_failed: "We couldn't complete the connection to WHOOP. Please try again.",
};

function ConnectPrompt({ errorMessage }: { errorMessage?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Connection failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <h1 className="text-2xl font-semibold">Connect your WHOOP account</h1>
      <p className="text-muted-foreground">
        Link your WHOOP membership to see recovery, sleep, and workout metrics here.
      </p>
      <Button size="lg" nativeButton={false} render={<Link href="/api/auth/login">Connect WHOOP</Link>} />
    </div>
  );
}

function settledRecords<T>(result: PromiseSettledResult<{ records: T[] }>): T[] {
  return result.status === "fulfilled" ? result.value.records : [];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; date?: string }>;
}) {
  const { error, date: dateParam } = await searchParams;
  const session = await getSession();

  if (!session) {
    return <ConnectPrompt errorMessage={error ? ERROR_MESSAGES[error] : undefined} />;
  }

  const date = dateParam ?? toDateKey(new Date());
  const { start, end } = dayRange(date);
  const baselineStart = dayRange(addDays(date, -8)).start;

  const [recoveryResult, sleepResult, workoutsResult, cyclesResult, baselineCyclesResult, profileResult] =
    await Promise.allSettled([
      getRecovery(session.accessToken, { start, end, limit: 5 }),
      getSleep(session.accessToken, { start, end, limit: 5 }),
      getWorkouts(session.accessToken, { start, end, limit: 10 }),
      getCycles(session.accessToken, { start, end, limit: 5 }),
      getCycles(session.accessToken, { start: baselineStart, end: start, limit: 10 }),
      getProfile(session.accessToken),
    ]);

  const coreResults = [recoveryResult, sleepResult, workoutsResult, cyclesResult];
  [recoveryResult, sleepResult, workoutsResult, cyclesResult, baselineCyclesResult, profileResult]
    .filter((result) => result.status === "rejected")
    .forEach((result) => console.error("Failed to load Whoop data", result.reason));

  if (coreResults.every((result) => result.status === "rejected")) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t load your WHOOP data</AlertTitle>
          <AlertDescription>
            Something went wrong fetching your metrics. Try refreshing, or reconnect your account.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const recoveryRecords = settledRecords<RecoveryRecord>(recoveryResult);
  const sleepRecords = settledRecords<SleepRecord>(sleepResult);
  const workoutRecords = settledRecords<WorkoutRecord>(workoutsResult)
    .slice()
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const cycleRecords = settledRecords<CycleRecord>(cyclesResult);
  const baselineCycles = settledRecords<CycleRecord>(baselineCyclesResult);
  const profile = profileResult.status === "fulfilled" ? profileResult.value : null;

  const recovery = recoveryRecords[0] ?? null;
  const sleep = sleepRecords[0] ?? null;
  const cycle = cycleRecords[0] ?? null;

  const recoveryScore = recovery?.score?.recovery_score ?? null;
  const sleepPerformance = sleep?.score?.sleep_performance_percentage ?? null;
  const dayStrain = cycle?.score?.strain ?? null;

  const baselineStrains = baselineCycles
    .map((record) => record.score?.strain)
    .filter((strain): strain is number => strain != null);
  const strainBaseline =
    baselineStrains.length > 0
      ? baselineStrains.reduce((sum, strain) => sum + strain, 0) / baselineStrains.length
      : null;

  const insight = generateInsight({ recoveryScore, sleepPerformance, strain: dayStrain, strainBaseline });

  const activities: DayActivity[] = [
    ...(sleep?.score?.stage_summary
      ? [
          {
            key: "sleep",
            label: "sleep",
            value: formatDuration(sleep.score.stage_summary.total_in_bed_time_milli),
            colorMode: "sleep" as const,
          },
        ]
      : []),
    ...workoutRecords.map((workout, index) => ({
      key: workout.id || `workout-${index}`,
      label: (workout.sport_name ?? "activity").toLowerCase(),
      value: workout.score?.strain != null ? workout.score.strain.toFixed(1) : "—",
      colorMode: "strain" as const,
    })),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <InteractiveGridBackground />
      {coreResults.some((result) => result.status === "rejected") && (
        <Alert className="mb-6">
          <AlertTitle>Some data couldn&apos;t be loaded</AlertTitle>
          <AlertDescription>Showing what did load — try refreshing to retry the rest.</AlertDescription>
        </Alert>
      )}

      <div className="animate-intro-fade [animation-delay:500ms]">
        <WelcomeBanner firstName={profile?.first_name ?? null} insight={insight} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="animate-intro-pop [animation-delay:1400ms]">
          <DateSelector date={date} activities={activities} />
        </div>
        <div className="animate-intro-pop [animation-delay:1500ms]">
          <AtAGlanceStats sleepPerformance={sleepPerformance} recoveryScore={recoveryScore} strain={dayStrain} />
        </div>
      </div>

      <div className="animate-intro-pop mt-4 [animation-delay:1600ms]">
        <InsightsCarousel
          sleep={sleep}
          recovery={recovery}
          sleepPerformance={sleepPerformance}
          dayStrain={dayStrain}
          workouts={workoutRecords}
        />
      </div>
    </div>
  );
}
