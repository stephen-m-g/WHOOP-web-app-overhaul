import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ResultsDisplay } from "@/components/jump-trainer/results-display";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { getProfile } from "@/lib/whoop";
import { getJumpDetail, type JumpDetail } from "@/lib/api";
import { cn, GLASS_CARD } from "@/lib/utils";

export default async function JumpDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  let detail: JumpDetail | null = null;
  if (session) {
    try {
      const profile = await getProfile(session.accessToken);
      detail = await getJumpDetail(id, String(profile.user_id));
    } catch (error) {
      console.error("Failed to load jump detail", error);
    }
  }

  return (
    <div className="scrollbar-hidden mx-auto h-full max-w-4xl overflow-y-auto px-4 py-12">
      <Link
        href="/jump-trainer/trends"
        className="animate-intro-fade mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Jump History
      </Link>
      {detail ? (
        <ResultsDisplay jumpType={detail.jump_type} result={detail.result} />
      ) : (
        <Card className={cn("animate-intro-fade", GLASS_CARD)}>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">
              This jump recording couldn&apos;t be found.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
