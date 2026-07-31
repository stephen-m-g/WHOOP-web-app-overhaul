import { config } from "./config";

export type JumpType = "vertical" | "broad";

export interface Keyframe {
  frame: number;
  type: "loading" | "penultimate_step" | "takeoff" | "peak" | "landing";
  timestamp_ms: number;
}

export interface DebugInfo {
  detection_rate: number;
  standing_frames_used: number;
  standing_hip_y_norm: number;
  standing_ankle_y_norm: number;
  hip_to_ankle_span_norm: number;
  estimated_px_per_cm: number;
  standing_y_norm: number;
  peak_y_norm: number;
  vertical_displacement_norm: number;
  vertical_displacement_px: number;
  calculation_note: string;
  headroom_norm: number;
  largest_tracking_gap_frames: number;
  largest_tracking_gap_ms: number;
  likely_missed_peak: boolean;
  horizontal_displacement_norm: number | null;
  horizontal_displacement_px: number | null;
  standing_frame_skeleton_b64: string | null;
  peak_frame_skeleton_b64: string | null;
}

export interface JumpAnalysisResult {
  jump_height_cm: number | null;
  jump_distance_cm: number | null;
  keyframes: Keyframe[];
  coaching_feedback: string;
  analysis_confidence: number;
  processing_time_ms: number;
  debug: DebugInfo | null;
}

export class BackendApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

export async function analyzeJump(
  video: File,
  userHeightCm: number,
  jumpType: JumpType = "vertical",
  includeDebug = false,
): Promise<JumpAnalysisResult> {
  const formData = new FormData();
  formData.append("video", video);
  formData.append("user_height_cm", String(userHeightCm));
  formData.append("jump_type", jumpType);
  formData.append("include_debug", String(includeDebug));

  const response = await fetch(`${config.backendUrl}/analyze-jump`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new BackendApiError(body.detail ?? "Jump analysis failed", response.status);
  }

  return response.json();
}
