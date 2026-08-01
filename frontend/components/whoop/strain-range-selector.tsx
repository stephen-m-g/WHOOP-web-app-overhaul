import Link from "next/link";
import { cn } from "@/lib/utils";

export type StrainRange = "day" | "week" | "2weeks" | "month" | "3months" | "6months";

const RANGE_OPTIONS: Array<{ value: StrainRange; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "2weeks", label: "2 Weeks" },
  { value: "month", label: "Month" },
  { value: "3months", label: "3 Months" },
  { value: "6months", label: "6 Months" },
];

interface StrainRangeSelectorProps {
  date: string;
  range: StrainRange;
}

export function StrainRangeSelector({ date, range }: StrainRangeSelectorProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-muted p-1">
      {RANGE_OPTIONS.map((option) => {
        const isActive = option.value === range;
        return (
          <Link
            key={option.value}
            href={`/strain?date=${date}&range=${option.value}`}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
