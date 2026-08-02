"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { JumpAnalysisResult, JumpType } from "@/lib/api";
import { saveJumpResult } from "@/lib/jump-result-store";
import { cn, GLASS_CARD } from "@/lib/utils";

const ALLOWED_TYPES = ["video/mp4", "video/quicktime"];
const MAX_SIZE_MB = 500;

const ACCENT_BUTTON =
  "cursor-pointer rounded-full bg-jump-trainer-accent font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * fetch() has no upload-progress event, so real byte-level progress requires
 * XMLHttpRequest instead. Wrapped in a promise to keep the call site async/await.
 */
function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void,
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Server returned an invalid response."));
        return;
      }
      resolve({ status: xhr.status, data });
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));

    xhr.send(formData);
  });
}

interface VideoUploadProps {
  bodyHeightCm: number | null;
  userId: string | null;
}

export function VideoUpload({ bodyHeightCm, userId }: VideoUploadProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [jumpType, setJumpType] = useState<JumpType>("vertical");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!file) return "Please select a video file.";
    if (!ALLOWED_TYPES.includes(file.type) && !/\.(mp4|mov)$/i.test(file.name)) {
      return "Only MP4 or MOV videos are supported.";
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Video must be smaller than ${MAX_SIZE_MB}MB.`;
    }
    if (bodyHeightCm == null) {
      return "Set your height in your WHOOP profile to enable analysis.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const formData = new FormData();
    formData.append("video", file as File);
    formData.append("userHeightCm", String(bodyHeightCm));
    formData.append("jumpType", jumpType);
    if (userId) formData.append("userId", userId);

    setIsAnalyzing(true);
    setUploadPercent(0);
    try {
      const { status, data } = await uploadWithProgress("/api/upload-jump", formData, setUploadPercent);
      if (status < 200 || status >= 300) {
        const errorData = data as { error?: string };
        throw new Error(errorData.error ?? "Analysis failed.");
      }
      const result = data as JumpAnalysisResult;
      await saveJumpResult({ jumpType, result });
      router.push("/jump-trainer/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsAnalyzing(false);
      setUploadPercent(null);
    }
  }

  const tips = [
    "Full body in frame — head to feet, not just legs",
    jumpType === "vertical"
      ? "Face the camera directly, not at an angle"
      : "Film from the side, perpendicular to your jump direction, so the camera sees you move across the frame",
    "Leave at least a foot of empty space above your head — if you jump out of frame, tracking is lost right at the peak",
    ...(jumpType === "broad"
      ? ["Leave several feet of space in front of you too, in the direction you'll jump"]
      : []),
    "Stand 8–12 feet from the camera",
    "Stand still for about a second before jumping — that's used to calibrate scale",
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className={cn("animate-intro-fade", GLASS_CARD)}>
        <CardContent>
          <h1 className="mb-3 text-lg font-bold tracking-tight">For Best Quality Measurements:</h1>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground/70">
            Calibration is based on your body proportions (hips to ankles).
          </p>
        </CardContent>
      </Card>

      <Card className={cn("animate-intro-fade [animation-delay:150ms]", GLASS_CARD)}>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 py-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">video:</span>
              <Label
                htmlFor="video"
                className={cn(ACCENT_BUTTON, "px-4 py-2 text-sm", isAnalyzing && "pointer-events-none")}
              >
                {file ? file.name : ".mp4 upload"}
              </Label>
              <input
                id="video"
                type="file"
                accept="video/mp4,video/quicktime,.mp4,.mov"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={isAnalyzing}
                className="sr-only"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">jump type:</span>
              <div className="flex items-center gap-1.5 text-sm">
                <button
                  type="button"
                  onClick={() => setJumpType("vertical")}
                  disabled={isAnalyzing}
                  className={cn(
                    "cursor-pointer transition-colors disabled:cursor-not-allowed",
                    jumpType === "vertical"
                      ? "font-semibold text-jump-trainer-accent"
                      : "font-normal text-muted-foreground hover:text-foreground",
                  )}
                >
                  vertical
                </button>
                <span className="text-muted-foreground">-</span>
                <button
                  type="button"
                  onClick={() => setJumpType("broad")}
                  disabled={isAnalyzing}
                  className={cn(
                    "cursor-pointer transition-colors disabled:cursor-not-allowed",
                    jumpType === "broad"
                      ? "font-semibold text-jump-trainer-accent"
                      : "font-normal text-muted-foreground hover:text-foreground",
                  )}
                >
                  broad
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">user height:</span>
              <span className="text-sm font-semibold tabular-nums">
                {bodyHeightCm != null ? `${bodyHeightCm} cm` : "Not set"}
              </span>
            </div>
            {bodyHeightCm == null && (
              <p className="-mt-4 text-xs text-muted-foreground">
                Set your height in your WHOOP profile to enable analysis.
              </p>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isAnalyzing && (
              <div className="space-y-2">
                {uploadPercent !== null && uploadPercent < 100 ? (
                  <>
                    <p className="text-sm text-muted-foreground">Uploading… {uploadPercent}%</p>
                    <Progress value={uploadPercent} />
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Analyzing your jump…</p>
                    <Progress value={null} className="animate-pulse" />
                  </>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isAnalyzing || !file}
              className={cn(ACCENT_BUTTON, "mx-auto px-10 py-2.5 text-sm")}
            >
              {isAnalyzing ? "Analyzing…" : "Analyze"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
