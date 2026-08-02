import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { JumpTrendsSection } from "@/components/jump-trainer/jump-trends-section";
import { JumpLog } from "@/components/jump-trainer/jump-log";
import { getSession } from "@/lib/auth";
import { getProfile } from "@/lib/whoop";
import { getJumpHistory, type JumpRecordSummary } from "@/lib/api";
import { cn, GLASS_CARD } from "@/lib/utils";

const HISTORY_FETCH_LIMIT = 500;

export default async function JumpTrainerTrendsPage() {
  const session = await getSession();

  let jumps: JumpRecordSummary[] = [];
  if (session) {
    try {
      const profile = await getProfile(session.accessToken);
      jumps = await getJumpHistory(String(profile.user_id), HISTORY_FETCH_LIMIT);
    } catch (error) {
      console.error("Failed to load jump history", error);
    }
  }

  return (
    <div className="scrollbar-hidden mx-auto h-full max-w-3xl overflow-y-auto px-4 py-12">
      <Link
        href="/jump-trainer"
        className="animate-intro-fade mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Jump Trainer
      </Link>

      <div className="flex flex-col gap-4">
        <Card className={cn("animate-intro-fade [animation-delay:150ms]", GLASS_CARD)}>
          <CardContent>
            <JumpTrendsSection jumps={jumps} />
          </CardContent>
        </Card>

        <Card className={cn("animate-intro-fade [animation-delay:300ms]", GLASS_CARD)}>
          <CardHeader>
            <h2 className="text-lg font-bold tracking-tight">Jump Log</h2>
          </CardHeader>
          <CardContent>
            {jumps.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No past jumps to review yet — this will let you revisit key frame feedback from
                previous analyses to track how your form changes over time.
              </p>
            ) : (
              <JumpLog jumps={jumps} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
