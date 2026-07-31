import { Card, CardContent } from "@/components/ui/card";
import { CircularGauge } from "@/components/whoop/circular-gauge";
import { cn, GLASS_CARD } from "@/lib/utils";

interface AtAGlanceStatsProps {
  sleepPerformance: number | null;
  recoveryScore: number | null;
  strain: number | null;
}

export function AtAGlanceStats({ sleepPerformance, recoveryScore, strain }: AtAGlanceStatsProps) {
  return (
    <Card className={cn("h-full", GLASS_CARD)}>
      <CardContent className="flex h-full flex-wrap items-center justify-around gap-6 py-2">
        <CircularGauge label="sleep" value={sleepPerformance} colorMode="sleep" href="/sleep" />
        <CircularGauge label="recovery" value={recoveryScore} colorMode="recovery" href="/recovery" />
        <CircularGauge
          label="strain"
          value={strain}
          colorMode="strain"
          href="/strain"
          formatValue={(v) => v.toFixed(1)}
        />
      </CardContent>
    </Card>
  );
}
