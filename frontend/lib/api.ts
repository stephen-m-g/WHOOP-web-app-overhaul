import { config } from "./config";

export type JumpType = "vertical" | "broad";

export type KeyframeStageType =
  | "initiation"
  | "max_anticipation"
  | "takeoff"
  | "peak"
  | "touchdown"
  | "max_absorption";

export interface KeyframeMetrics {
  knee_flexion_deg: number | null;
  knee_valgus_norm: number | null;
  torso_lean_deg: number | null;
  concerns: string[];
}

export interface KeyframeAnalysis {
  type: KeyframeStageType;
  frame: number;
  timestamp_ms: number;
  image_b64: string | null;
  metrics: KeyframeMetrics;
  feedback: string;
}

export interface CameraSetupWarning {
  code: string;
  message: string;
}

export interface JumpAnalysisResult {
  jump_height_cm: number | null;
  jump_distance_cm: number | null;
  keyframe_analyses: KeyframeAnalysis[];
  coaching_feedback: string;
  analysis_confidence: number;
  processing_time_ms: number;
  camera_warnings: CameraSetupWarning[];
}

export interface JumpRecordSummary {
  id: string;
  created_at: string;
  jump_type: JumpType;
  jump_height_cm: number | null;
  jump_distance_cm: number | null;
  analysis_confidence: number;
}

export interface JumpDetail {
  id: string;
  created_at: string;
  jump_type: JumpType;
  result: JumpAnalysisResult;
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
  userId?: string | null,
): Promise<JumpAnalysisResult> {
  const formData = new FormData();
  formData.append("video", video);
  formData.append("user_height_cm", String(userHeightCm));
  formData.append("jump_type", jumpType);
  if (userId) formData.append("user_id", userId);

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

export async function getJumpHistory(userId: string, limit = 20): Promise<JumpRecordSummary[]> {
  const params = new URLSearchParams({ user_id: userId, limit: String(limit) });
  const response = await fetch(`${config.backendUrl}/jumps?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new BackendApiError(body.detail ?? "Failed to load jump history", response.status);
  }

  const data: { jumps: JumpRecordSummary[] } = await response.json();
  return data.jumps;
}

export async function getJumpDetail(recordId: string, userId: string): Promise<JumpDetail> {
  const params = new URLSearchParams({ user_id: userId });
  const response = await fetch(`${config.backendUrl}/jumps/${encodeURIComponent(recordId)}?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new BackendApiError(body.detail ?? "Failed to load jump detail", response.status);
  }

  return response.json();
}
