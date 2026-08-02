"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ResultsDisplay } from "@/components/jump-trainer/results-display";
import { readJumpResult } from "@/lib/jump-result-store";
import type { JumpAnalysisResult, JumpType } from "@/lib/api";

interface StoredResult {
  jumpType: JumpType;
  result: JumpAnalysisResult;
}

export default function JumpTrainerResultsPage() {
  const router = useRouter();
  // undefined = still loading from IndexedDB, null = nothing found.
  const [stored, setStored] = useState<StoredResult | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    readJumpResult<StoredResult>()
      .then((value) => {
        if (!cancelled) setStored(value);
      })
      .catch(() => {
        if (!cancelled) setStored(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (stored === null) {
      router.replace("/jump-trainer");
    }
  }, [stored, router]);

  if (!stored) return null;

  return (
    <div className="scrollbar-hidden mx-auto h-full max-w-4xl overflow-y-auto px-4 py-12">
      <Link
        href="/jump-trainer"
        className="animate-intro-fade mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Jump Trainer
      </Link>
      <ResultsDisplay jumpType={stored.jumpType} result={stored.result} />
    </div>
  );
}
