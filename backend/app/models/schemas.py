"""Pydantic request/response models for the jump analysis API."""
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class KeyframeType(str, Enum):
    """The 6 stages of a jump we detect and generate coaching feedback for.

    INITIATION: upright standing position right before the jump begins.
    MAX_ANTICIPATION: lowest point of the counter-movement dip, right before
        driving upward (deepest crouch).
    TAKEOFF: last instant the feet are still in contact with the ground.
    PEAK: highest point of the jump.
    TOUCHDOWN: first instant the feet make contact with the ground again.
    MAX_ABSORPTION: point of deepest knee bend while absorbing the landing.
    """

    INITIATION = "initiation"
    MAX_ANTICIPATION = "max_anticipation"
    TAKEOFF = "takeoff"
    PEAK = "peak"
    TOUCHDOWN = "touchdown"
    MAX_ABSORPTION = "max_absorption"


class JumpType(str, Enum):
    VERTICAL = "vertical"
    BROAD = "broad"


class KeyframeMetrics(BaseModel):
    """Biomechanical facts computed at a single keyframe from tracked joint
    positions. This is the deterministic "knowledge" layer — the coaching LLM
    only ever paraphrases these pre-computed facts and flags, it never judges
    form on its own."""

    knee_flexion_deg: float | None = Field(
        None, description="Knee joint angle in degrees (hip-knee-ankle); 180 = fully straight leg"
    )
    knee_valgus_norm: float | None = Field(
        None,
        description="Lateral knee deviation from the hip-ankle line, normalized to leg length. "
        "Positive = knees caving inward (valgus), negative = bowing outward (varus).",
    )
    torso_lean_deg: float | None = Field(
        None, description="Torso angle from vertical, degrees; 0 = perfectly upright"
    )
    concerns: list[str] = Field(
        default_factory=list, description="Rule-flagged form issue codes at this keyframe, e.g. 'knee_valgus'"
    )


class KeyframeAnalysis(BaseModel):
    type: KeyframeType
    frame: int = Field(..., description="Frame index within the source video")
    timestamp_ms: int = Field(..., description="Timestamp of this frame in milliseconds")
    image_b64: str | None = Field(None, description="JPEG (base64) of this frame with the skeleton overlay drawn on it")
    metrics: KeyframeMetrics
    feedback: str = Field(..., description="Coaching feedback for this specific stage")


class CameraSetupWarning(BaseModel):
    """A detected issue with how the video was filmed that may have degraded
    measurement accuracy — surfaced instead of silently returning a number
    that's likely wrong."""

    code: str
    message: str


class DebugInfo(BaseModel):
    """Intermediate calculation values, for diagnosing bad estimates. Only
    populated when the request sets include_debug=true."""

    detection_rate: float = Field(..., description="Fraction of frames where a body was detected")
    standing_frames_used: int = Field(..., description="Number of standing frames used for calibration")
    standing_hip_y_norm: float = Field(..., description="Average normalized hip y-position while standing")
    standing_ankle_y_norm: float = Field(..., description="Average normalized ankle y-position while standing")
    hip_to_ankle_span_norm: float = Field(..., description="Normalized hip-to-ankle span used for calibration")
    estimated_px_per_cm: float = Field(..., description="2D calibration scale factor, in pixels per cm")
    standing_y_norm: float = Field(..., description="Smoothed ankle y-position while standing, pre-jump")
    peak_y_norm: float = Field(..., description="Smoothed ankle y-position at the jump's peak")
    vertical_displacement_norm: float = Field(..., description="standing_y_norm - peak_y_norm")
    vertical_displacement_px: float = Field(..., description="Vertical displacement converted to pixels")
    calculation_note: str = Field(..., description="Human-readable summary of the height calculation")
    headroom_norm: float = Field(
        ..., description="Normalized distance from the top of frame to the top of the head while standing"
    )
    largest_tracking_gap_frames: int = Field(
        ..., description="Longest run of consecutive frames where no body was detected at all"
    )
    largest_tracking_gap_ms: float = Field(..., description="Duration of the longest tracking gap, in ms")
    likely_missed_peak: bool = Field(
        ...,
        description="True if the longest tracking gap overlaps the detected peak, suggesting the "
        "real jump peak was dropped (probably because part of the body left the frame)",
    )
    horizontal_displacement_norm: float | None = Field(
        None, description="Broad jump only: horizontal ankle displacement, normalized to frame width"
    )
    horizontal_displacement_px: float | None = Field(
        None, description="Broad jump only: horizontal ankle displacement, in pixels"
    )
    jump_height_cm_world_landmarks_comparison: float | None = Field(
        None,
        description="Height estimate from MediaPipe's 3D world landmarks, kept only for comparison — NOT used "
        "as the primary estimate. World landmarks are hip-relative (the origin moves with the body), so they "
        "structurally can't see whole-body translation through space, which is what jump height/distance "
        "actually is. Confirmed against real footage: this path returned an exact 0.0cm for a jump the 2D "
        "pixel-calibration path (the primary jump_height_cm/jump_distance_cm) correctly measured.",
    )


class JumpAnalysisResponse(BaseModel):
    jump_height_cm: float | None = Field(None, description="Estimated vertical jump height in cm")
    jump_distance_cm: float | None = Field(None, description="Estimated broad jump distance in cm")
    keyframe_analyses: list[KeyframeAnalysis]
    coaching_feedback: str = Field(..., description="Overall one-line summary, in addition to per-keyframe detail")
    analysis_confidence: float = Field(..., ge=0.0, le=1.0)
    processing_time_ms: int
    camera_warnings: list[CameraSetupWarning] = Field(default_factory=list)
    debug: DebugInfo | None = Field(None, description="Present only when include_debug=true was requested")


class JumpRecordSummary(BaseModel):
    """One row of jump history — summary fields only, not full keyframe
    detail (see storage.py's Firestore document for that)."""

    id: str
    created_at: datetime
    jump_type: JumpType
    jump_height_cm: float | None = None
    jump_distance_cm: float | None = None
    analysis_confidence: float


class JumpHistoryResponse(BaseModel):
    jumps: list[JumpRecordSummary] = Field(default_factory=list)


class JumpDetailResponse(BaseModel):
    """A single stored jump, in full — the same shape the analysis endpoint
    returns right after processing, plus the metadata (id, created_at,
    jump_type) needed to know WHICH jump this is, since a re-fetched record
    doesn't otherwise carry that context the way a live upload does."""

    id: str
    created_at: datetime
    jump_type: JumpType
    result: JumpAnalysisResponse


class ErrorResponse(BaseModel):
    detail: str
