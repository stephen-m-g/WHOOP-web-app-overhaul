import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { JumpAnalysisResult } from "@/lib/api";

const KEYFRAME_LABELS: Record<string, string> = {
  loading: "Loading",
  penultimate_step: "Penultimate Step",
  takeoff: "Takeoff",
  peak: "Peak",
  landing: "Landing",
};

export function ResultsDisplay({ result }: { result: JumpAnalysisResult }) {
  const confidencePct = Math.round(result.analysis_confidence * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Jump Analysis</CardTitle>
          <Badge variant={confidencePct >= 50 ? "default" : "destructive"}>
            {confidencePct}% confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Jump Height</p>
            <p className="text-2xl font-bold">
              {result.jump_height_cm !== null ? `${result.jump_height_cm} cm` : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Jump Distance</p>
            <p className="text-2xl font-bold">
              {result.jump_distance_cm !== null ? `${result.jump_distance_cm} cm` : "N/A"}
            </p>
          </div>
        </div>

        <Separator />

        <div>
          <p className="mb-2 text-sm font-medium">Coaching Feedback</p>
          <p className="text-sm text-muted-foreground">{result.coaching_feedback}</p>
        </div>

        {result.keyframes.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-2 text-sm font-medium">Keyframes</p>
              <div className="flex flex-wrap gap-2">
                {result.keyframes.map((kf) => (
                  <Badge key={`${kf.type}-${kf.frame}`} variant="outline">
                    {KEYFRAME_LABELS[kf.type] ?? kf.type} — {(kf.timestamp_ms / 1000).toFixed(2)}s
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Processed in {result.processing_time_ms}ms
        </p>
      </CardContent>
    </Card>
  );
}
