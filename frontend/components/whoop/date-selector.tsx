import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { addDays, formatDayLabel, isFutureDate } from "@/lib/date";
import { cn, GLASS_CARD } from "@/lib/utils";

export interface DayActivity {
  key: string;
  label: string;
  value: string;
  colorMode: "sleep" | "strain";
}

interface DateSelectorProps {
  date: string;
  activities: DayActivity[];
}

const BADGE_COLOR: Record<DayActivity["colorMode"], string> = {
  sleep: "bg-metric-sleep text-white",
  strain: "bg-metric-strain text-white",
};

export function DateSelector({ date, activities }: DateSelectorProps) {
  const nextDate = addDays(date, 1);
  const nextDisabled = isFutureDate(nextDate);

  return (
    <Card className={cn("h-full", GLASS_CARD)}>
      <CardHeader>
        <div className="flex items-center justify-center gap-2">
          <Link
            href={`/dashboard?date=${addDays(date, -1)}`}
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Previous day"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="font-stat text-lg font-semibold tracking-wide">{formatDayLabel(date)}</span>
          {nextDisabled ? (
            <span className="rounded-md p-1 text-muted-foreground/30" aria-hidden="true">
              <ChevronRight className="size-4" />
            </span>
          ) : (
            <Link
              href={`/dashboard?date=${nextDate}`}
              className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Next day"
            >
              <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activities recorded this day.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activities.map((activity) => (
              <li key={activity.key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">{activity.label}</span>
                <Badge className={cn(BADGE_COLOR[activity.colorMode])}>{activity.value}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
