import Link from "next/link";
import { ChevronLeft, TrendingUp, MessageSquareText } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn, GLASS_CARD } from "@/lib/utils";

export default function JumpTrainerTrendsPage() {
  return (
    <div className="scrollbar-hidden mx-auto h-full max-w-2xl overflow-y-auto px-4 py-12">
      <Link
        href="/jump-trainer"
        className="animate-intro-fade mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Jump Trainer
      </Link>

      <div className="flex flex-col gap-4">
        <Card className={cn("animate-intro-fade [animation-delay:150ms]", GLASS_CARD)}>
          <CardHeader>
            <h1 className="text-lg font-bold tracking-tight">Height &amp; Distance Over Time</h1>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-foreground/20 py-10 text-center">
              <TrendingUp className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                No jumps logged yet — once your analyzed jumps are saved, this will chart your
                vertical height and broad distance over time.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("animate-intro-fade [animation-delay:300ms]", GLASS_CARD)}>
          <CardHeader>
            <h2 className="text-lg font-bold tracking-tight">Past Jump Feedback</h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-foreground/20 py-10 text-center">
              <MessageSquareText className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                No past jumps to review yet — this will let you revisit key frame feedback from
                previous analyses to track how your form changes over time.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
