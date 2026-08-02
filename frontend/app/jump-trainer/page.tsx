import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { VideoUpload } from "@/components/jump-trainer/video-upload";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { getBodyMeasurement, getProfile } from "@/lib/whoop";
import { getJumpHistory, type JumpRecordSummary } from "@/lib/api";
import { formatJumpDate, formatMeasurement, measurementCmFor } from "@/lib/jump-stats";
import { cn, GLASS_CARD } from "@/lib/utils";

const RECENT_JUMPS_LIMIT = 5;

export default async function JumpTrainerPage() {
  const session = await getSession();

  let bodyHeightCm: number | null = null;
  let userId: string | null = null;
  let recentJumps: JumpRecordSummary[] = [];
  if (session) {
    try {
      const measurement = await getBodyMeasurement(session.accessToken);
      bodyHeightCm = Math.round(measurement.height_meter * 100);
    } catch (error) {
      console.error("Failed to load body measurement", error);
    }
    try {
      const profile = await getProfile(session.accessToken);
      userId = String(profile.user_id);
    } catch (error) {
      console.error("Failed to load Whoop profile", error);
    }
    if (userId) {
      try {
        recentJumps = await getJumpHistory(userId, RECENT_JUMPS_LIMIT);
      } catch (error) {
        console.error("Failed to load jump history", error);
      }
    }
  }

  return (
    <div className="scrollbar-hidden mx-auto h-full max-w-2xl overflow-y-auto px-4 py-12">
      <VideoUpload bodyHeightCm={bodyHeightCm} userId={userId} />

      <Card className={cn("animate-intro-fade mt-4 [animation-delay:300ms]", GLASS_CARD)}>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Recent Recordings</h2>
          <Link
            href="/jump-trainer/trends"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-jump-trainer-accent px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            more
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="mb-3 grid grid-cols-3 gap-4 text-xs text-muted-foreground">
            <span>date</span>
            <span>type</span>
            <span>measurement</span>
          </div>
          {recentJumps.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No jumps recorded yet — analyze your first jump above to see it here.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {recentJumps.map((jump) => {
                const cm = measurementCmFor(jump);
                return (
                  <Link
                    key={jump.id}
                    href={`/jump-trainer/results/${jump.id}`}
                    className="-mx-2 grid grid-cols-3 gap-4 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    <span>{formatJumpDate(jump.created_at)}</span>
                    <span className="capitalize">{jump.jump_type}</span>
                    <span className="font-semibold tabular-nums">
                      {cm != null ? formatMeasurement(cm, "metric") : "N/A"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
