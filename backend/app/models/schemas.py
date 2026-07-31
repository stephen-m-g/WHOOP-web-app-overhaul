"""Pydantic request/response models for the jump analysis API."""
from enum import Enum

from pydantic import BaseModel, Field


class KeyframeType(str, Enum):
    LOADING = "loading"
    PENULTIMATE_STEP = "penultimate_step"
    TAKEOFF = "takeoff"
    PEAK = "peak"
    LANDING = "landing"


class JumpType(str, Enum):
    VERTICAL = "vertical"
    BROAD = "broad"


class Keyframe(BaseModel):
    frame: int = Field(..., description="Frame index within the source video")
    type: KeyframeType
    timestamp_ms: int = Field(..., description="Timestamp of this frame in milliseconds")


class DebugInfo(BaseModel):
    """Intermediate calculation values, for diagnosing bad estimates. Only
    populated when the request sets include_debug=true."""

    detection_rate: float = Field(..., description="Fraction of frames where a body was detected")
    standing_frames_used: int = Field(..., description="Number of standing frames used for calibration")
    standing_hip_y_norm: float = Field(..., description="Average normalized hip y-position while standing")
    standing_ankle_y_norm: float = Field(..., description="Average normalized ankle y-position while standing")
    hip_to_ankle_span_norm: float = Field(..., description="Normalized hip-to-ankle span used for calibration")
    estimated_px_per_cm: float = Field(..., description="Calibration scale factor, in pixels per cm")
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
    standing_frame_skeleton_b64: str | None = Field(
        None, description="JPEG (base64) of the standing calibration frame with landmarks overlaid"
    )
    peak_frame_skeleton_b64: str | None = Field(
        None, description="JPEG (base64) of the jump's peak frame with landmarks overlaid"
    )


class JumpAnalysisResponse(BaseModel):
    jump_height_cm: float | None = Field(None, description="Estimated vertical jump height in cm")
    jump_distance_cm: float | None = Field(None, description="Estimated broad jump distance in cm")
    keyframes: list[Keyframe]
    coaching_feedback: str
    analysis_confidence: float = Field(..., ge=0.0, le=1.0)
    processing_time_ms: int
    debug: DebugInfo | None = Field(None, description="Present only when include_debug=true was requested")


class ErrorResponse(BaseModel):
    detail: str
