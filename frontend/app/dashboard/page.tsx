import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataCards } from "@/components/whoop/data-cards";
import { getSession } from "@/lib/auth";
import { getRecovery, getSleep, getWorkouts } from "@/lib/whoop";

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

// Extracts display metrics from raw Whoop API records. Field names are
// best-effort based on the v2 API shape described in developer.whoop.com
// docs — verify once real credentials/responses are available.
function extractMetrics(
  recovery: { records: unknown[] },
  sleep: { records: unknown[] },
  workouts: { records: unknown[] },
) {
  const latestRecovery = recovery.records[0] as { score?: { recovery_score?: number } } | undefined;
  const latestSleep = sleep.records[0] as { score?: { sleep_performance_percentage?: number } } | undefined;
  const latestWorkout = workouts.records[0] as { score?: { strain?: number } } | undefined;

  return {
    recoveryScore: latestRecovery?.score?.recovery_score ?? null,
    sleepPerformance: latestSleep?.score?.sleep_performance_percentage ?? null,
    latestWorkoutStrain: latestWorkout?.score?.strain ?? null,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await getSession();

  if (!session) {
    return <ConnectPrompt errorMessage={error ? ERROR_MESSAGES[error] : undefined} />;
  }

  let metrics: ReturnType<typeof extractMetrics> | null = null;
  try {
    const [recovery, sleep, workouts] = await Promise.all([
      getRecovery(session.accessToken, { limit: 5 }),
      getSleep(session.accessToken, { limit: 5 }),
      getWorkouts(session.accessToken, { limit: 5 }),
    ]);
    metrics = extractMetrics(recovery, sleep, workouts);
  } catch (err) {
    console.error("Failed to load Whoop metrics", err);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {metrics ? (
        <>
          <h1 className="mb-8 text-3xl font-bold tracking-tight">Your Metrics</h1>
          <DataCards {...metrics} />
        </>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t load your WHOOP data</AlertTitle>
          <AlertDescription>
            Something went wrong fetching your metrics. Try refreshing, or reconnect your account.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
