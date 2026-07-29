import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
}

function MetricCard({ title, value, subtitle }: MetricCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

interface DataCardsProps {
  recoveryScore: number | null;
  sleepPerformance: number | null;
  latestWorkoutStrain: number | null;
}

/**
 * Placeholder metric extraction — Whoop API v2 response field names should
 * be verified against real payloads once credentials are available (see
 * app/dashboard/page.tsx for where these are computed from raw records).
 */
export function DataCards({ recoveryScore, sleepPerformance, latestWorkoutStrain }: DataCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MetricCard
        title="Recovery"
        value={recoveryScore !== null ? `${Math.round(recoveryScore)}%` : "—"}
        subtitle="Today"
      />
      <MetricCard
        title="Sleep Performance"
        value={sleepPerformance !== null ? `${Math.round(sleepPerformance)}%` : "—"}
        subtitle="Last night"
      />
      <MetricCard
        title="Latest Strain"
        value={latestWorkoutStrain !== null ? latestWorkoutStrain.toFixed(1) : "—"}
        subtitle="Most recent workout"
      />
    </div>
  );
}
