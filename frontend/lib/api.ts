import { config } from "./config";

export interface Keyframe {
  frame: number;
  type: "loading" | "penultimate_step" | "takeoff" | "peak" | "landing";
  timestamp_ms: number;
}

export interface JumpAnalysisResult {
  jump_height_cm: number | null;
  jump_distance_cm: number | null;
  keyframes: Keyframe[];
  coaching_feedback: string;
  analysis_confidence: number;
  processing_time_ms: number;
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

export async function analyzeJump(video: File, userHeightCm: number): Promise<JumpAnalysisResult> {
  const formData = new FormData();
  formData.append("video", video);
  formData.append("user_height_cm", String(userHeightCm));

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
