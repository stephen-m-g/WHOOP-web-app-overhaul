import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { VideoUpload } from "@/components/jump-trainer/video-upload";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { getBodyMeasurement } from "@/lib/whoop";
import { cn, GLASS_CARD } from "@/lib/utils";

export default async function JumpTrainerPage() {
  const session = await getSession();

  let bodyHeightCm: number | null = null;
  if (session) {
    try {
      const measurement = await getBodyMeasurement(session.accessToken);
      bodyHeightCm = Math.round(measurement.height_meter * 100);
    } catch (error) {
      console.error("Failed to load body measurement", error);
    }
  }

  return (
    <div className="scrollbar-hidden mx-auto h-full max-w-2xl overflow-y-auto px-4 py-12">
      <VideoUpload bodyHeightCm={bodyHeightCm} />

      <Card className={cn("animate-intro-fade mt-4 [animation-delay:300ms]", GLASS_CARD)}>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Past Recordings</h2>
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
          <p className="py-6 text-center text-sm text-muted-foreground">
            No jumps recorded yet — analyze your first jump above to see it here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
