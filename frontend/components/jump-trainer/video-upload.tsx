"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ResultsDisplay } from "@/components/jump-trainer/results-display";
import type { JumpAnalysisResult } from "@/lib/api";

const ALLOWED_TYPES = ["video/mp4", "video/quicktime"];
const MAX_SIZE_MB = 500;
const MIN_HEIGHT_CM = 140;
const MAX_HEIGHT_CM = 220;

export function VideoUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [heightCm, setHeightCm] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/upload-jump", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Analysis failed.");
      }
      setResult(data as JumpAnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Your Jump</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isAnalyzing && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Analyzing your jump…</p>
                <Progress value={null} className="animate-pulse" />
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
