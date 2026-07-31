import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { DebugInfo } from "@/lib/api";

const FIELD_LABELS: Record<
  keyof Omit<
    DebugInfo,
    | "standing_frame_skeleton_b64"
    | "peak_frame_skeleton_b64"
    | "calculation_note"
    | "likely_missed_peak"
    | "horizontal_displacement_norm"
    | "horizontal_displacement_px"
  >,
  string
> = {
  detection_rate: "Detection rate",
  standing_frames_used: "Standing frames used",
  standing_hip_y_norm: "Standing hip y (normalized)",
  standing_ankle_y_norm: "Standing ankle y (normalized)",
  hip_to_ankle_span_norm: "Hip-to-ankle span (normalized)",
  estimated_px_per_cm: "Calibration scale (px/cm)",
  standing_y_norm: "Standing ankle y (smoothed)",
  peak_y_norm: "Peak ankle y (smoothed)",
  vertical_displacement_norm: "Vertical displacement (normalized)",
  vertical_displacement_px: "Vertical displacement (px)",
  headroom_norm: "Headroom above head while standing (normalized)",
  largest_tracking_gap_frames: "Longest tracking gap (frames)",
  largest_tracking_gap_ms: "Longest tracking gap (ms)",
};

const HORIZONTAL_FIELD_LABELS: Record<"horizontal_displacement_norm" | "horizontal_displacement_px", string> = {
  horizontal_displacement_norm: "Horizontal displacement (normalized)",
  horizontal_displacement_px: "Horizontal displacement (px)",
};

function SkeletonFrame({ label, base64 }: { label: string; base64: string | null }) {
  if (!base64) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No frame available
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URI, not an optimizable remote/local asset */}
      <img
        src={`data:image/jpeg;base64,${base64}`}
        alt={label}
        className="w-full rounded-md border"
      />
      <p className="text-xs text-muted-foreground">
        Blue dots = landmark detected confidently. Red dots = low visibility/confidence.
      </p>
    </div>
  );
}

export function DebugPanel({ debug }: { debug: DebugInfo }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {debug.likely_missed_peak && (
          <Alert variant="destructive">
            <AlertTitle>Likely missed the real peak</AlertTitle>
            <AlertDescription>
              Tracking was lost for {debug.largest_tracking_gap_frames} consecutive frames
              (~{debug.largest_tracking_gap_ms.toFixed(0)}ms) right around the detected peak.
              This usually means part of your body — often the head — left the frame at the top
              of the jump, so MediaPipe couldn&apos;t detect a pose at all for those frames. The
              &quot;peak&quot; shown below is probably not your actual highest point. Try
              stepping back from the camera to leave more headroom.
            </AlertDescription>
          </Alert>
        )}

        {!debug.likely_missed_peak && debug.headroom_norm < 0.15 && (
          <Alert>
            <AlertTitle>Limited headroom</AlertTitle>
            <AlertDescription>
              Your head is close to the top of the frame while standing (
              {(debug.headroom_norm * 100).toFixed(0)}% of frame height from the top). If you
              jump high, you may leave the frame and lose tracking at the peak. Consider stepping
              back from the camera.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SkeletonFrame label="Standing (calibration) frame" base64={debug.standing_frame_skeleton_b64} />
          <SkeletonFrame label="Peak frame" base64={debug.peak_frame_skeleton_b64} />
        </div>

        <Separator />

        <div>
          <p className="mb-2 text-sm font-medium">Calculation</p>
          <p className="rounded-md bg-muted p-3 font-mono text-xs">{debug.calculation_note}</p>
        </div>

        <Separator />

        <div>
          <p className="mb-2 text-sm font-medium">Intermediate Values</p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            {(Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>).map((key) => (
              <div key={key} className="flex justify-between gap-2 border-b py-1">
                <dt className="text-muted-foreground">{FIELD_LABELS[key]}</dt>
                <dd className="font-mono">{debug[key]}</dd>
              </div>
            ))}
            {debug.horizontal_displacement_norm !== null &&
              (Object.keys(HORIZONTAL_FIELD_LABELS) as Array<keyof typeof HORIZONTAL_FIELD_LABELS>).map((key) => (
                <div key={key} className="flex justify-between gap-2 border-b py-1">
                  <dt className="text-muted-foreground">{HORIZONTAL_FIELD_LABELS[key]}</dt>
                  <dd className="font-mono">{debug[key]}</dd>
                </div>
              ))}
          </dl>
        </div>

        <p className="text-xs text-muted-foreground">
          Check that the skeleton dots line up with your actual joints, especially hips and
          ankles (used for calibration). If the standing frame&apos;s hip/ankle dots are
          misplaced, the calibration — and therefore the height estimate — will be wrong even
          if the overall pose looks roughly right.
        </p>
      </CardContent>
    </Card>
  );
}
