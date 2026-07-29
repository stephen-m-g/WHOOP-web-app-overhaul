"""Pydantic request/response models for the jump analysis API."""
from enum import Enum

from pydantic import BaseModel, Field


class KeyframeType(str, Enum):
    LOADING = "loading"
    PENULTIMATE_STEP = "penultimate_step"
    TAKEOFF = "takeoff"
    PEAK = "peak"
    LANDING = "landing"


class Keyframe(BaseModel):
    frame: int = Field(..., description="Frame index within the source video")
    type: KeyframeType
    timestamp_ms: int = Field(..., description="Timestamp of this frame in milliseconds")


class JumpAnalysisResponse(BaseModel):
    jump_height_cm: float | None = Field(None, description="Estimated vertical jump height in cm")
    jump_distance_cm: float | None = Field(None, description="Estimated broad jump distance in cm")
    keyframes: list[Keyframe]
    coaching_feedback: str
    analysis_confidence: float = Field(..., ge=0.0, le=1.0)
    processing_time_ms: int


class ErrorResponse(BaseModel):
    detail: str
