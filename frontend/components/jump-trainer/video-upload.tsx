"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResultsDisplay } from "@/components/jump-trainer/results-display";
import type { JumpAnalysisResult, JumpType } from "@/lib/api";

const ALLOWED_TYPES = ["video/mp4", "video/quicktime"];
const MAX_SIZE_MB = 500;
const MIN_HEIGHT_CM = 140;
const MAX_HEIGHT_CM = 220;

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

export function VideoUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [heightCm, setHeightCm] = useState("");
  const [jumpType, setJumpType] = useState<JumpType>("vertical");
  const [includeDebug, setIncludeDebug] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JumpAnalysisResult | null>(null);

  function validate(): string | null {
    if (!file) return "Please select a video file.";
    if (!ALLOWED_TYPES.includes(file.type) && !/\.(mp4|mov)$/i.test(file.name)) {
      return "Only MP4 or MOV videos are supported.";
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Video must be smaller than ${MAX_SIZE_MB}MB.`;
    }
    const height = Number(heightCm);
    if (!heightCm || Number.isNaN(height) || height < MIN_HEIGHT_CM || height > MAX_HEIGHT_CM) {
      return `Height must be between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM} cm.`;
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const formData = new FormData();
    formData.append("video", file as File);
    formData.append("userHeightCm", heightCm);
    formData.append("jumpType", jumpType);
    formData.append("includeDebug", String(includeDebug));

    setIsAnalyzing(true);
    setUploadPercent(0);
    try {
      const { status, data } = await uploadWithProgress("/api/upload-jump", formData, setUploadPercent);
      if (status < 200 || status >= 300) {
        const errorData = data as { error?: string };
        throw new Error(errorData.error ?? "Analysis failed.");
      }
      setResult(data as JumpAnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsAnalyzing(false);
      setUploadPercent(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <CardContent className="pt-6 text-sm text-blue-900 dark:text-blue-100">
          <p className="mb-2">
            <strong>For an accurate reading:</strong>
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Full body in frame — head to feet, not just legs</li>
            {jumpType === "vertical" ? (
              <li>Face the camera directly (not at an angle)</li>
            ) : (
              <li>
                Film from the <strong>side</strong>, perpendicular to your jump direction — the
                camera needs to see you move left-to-right (or right-to-left) across the frame
              </li>
            )}
            <li>
              Leave at least a foot of empty space <strong>above your head</strong>{" "}
              in the frame — if you jump high enough to leave the frame, tracking is lost for
              those instants and the peak of your jump may be missed entirely
            </li>
            {jumpType === "broad" && (
              <li>
                Leave several feet of empty space <strong>in front of you</strong>{" "}
                in the frame too, in the direction you&apos;ll jump — landing outside the frame
                means we can&apos;t measure the distance
              </li>
            )}
            <li>Stand 8–12 feet from the camera to fit that headroom in while staying close enough to track well</li>
            <li>Stand still for the first ~1 second before jumping — that&apos;s used to calibrate scale</li>
            <li>Good, even lighting and a plain background help detection</li>
          </ul>
          <p className="mt-2 text-xs text-blue-800/80 dark:text-blue-200/80">
            Calibration is based on your body proportions (hips to ankles), not objects in the
            frame — a ruler or reference marker won&apos;t currently improve accuracy. Turn on
            &quot;Show debug info&quot; below to check whether your peak was tracked correctly.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Your Jump</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jump-type">Jump Type</Label>
              <Select value={jumpType} onValueChange={(value) => setJumpType(value as JumpType)}>
                <SelectTrigger id="jump-type" className="w-full" disabled={isAnalyzing}>
                  <SelectValue placeholder="Select jump type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertical">Vertical Jump</SelectItem>
                  <SelectItem value="broad">Broad Jump (standing long jump)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="video">Jump Video (MP4 or MOV)</Label>
              <Input
                id="video"
                type="file"
                accept="video/mp4,video/quicktime,.mp4,.mov"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={isAnalyzing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="height">Your Height (cm)</Label>
              <Input
                id="height"
                type="number"
                min={MIN_HEIGHT_CM}
                max={MAX_HEIGHT_CM}
                placeholder="180"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                disabled={isAnalyzing}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="include-debug"
                checked={includeDebug}
                onCheckedChange={(checked) => setIncludeDebug(checked === true)}
                disabled={isAnalyzing}
              />
              <Label htmlFor="include-debug" className="font-normal text-muted-foreground">
                Show debug info (skeleton overlay + calibration math)
              </Label>
            </div>

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

            <Button type="submit" disabled={isAnalyzing} className="w-full">
              {isAnalyzing ? "Analyzing…" : "Analyze Jump"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && <ResultsDisplay result={result} />}
    </div>
  );
}
