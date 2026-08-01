"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ResultsDisplay } from "@/components/jump-trainer/results-display";
import type { JumpAnalysisResult, JumpType } from "@/lib/api";

const RESULT_STORAGE_KEY = "jumpTrainerResult";

interface StoredResult {
  jumpType: JumpType;
  result: JumpAnalysisResult;
}

function readStoredResult(): StoredResult | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(RESULT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredResult;
  } catch {
    return null;
  }
}

export default function JumpTrainerResultsPage() {
  const router = useRouter();
  const [stored] = useState<StoredResult | null>(readStoredResult);

  useEffect(() => {
    if (!stored) {
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
