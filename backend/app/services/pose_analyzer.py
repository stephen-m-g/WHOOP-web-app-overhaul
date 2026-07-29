"""MediaPipe Pose-based analysis of a jump video.

Pipeline: run MediaPipe Pose on every frame to get 33 body landmarks,
track vertical ankle position over time to find the loading/takeoff/peak/
landing keyframes, then convert pixel displacement to real-world
centimeters using the user's known height as a calibration reference.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass

import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

from app.models.schemas import Keyframe, KeyframeType

logger = logging.getLogger(__name__)

# Path to the PoseLandmarker model bundle. Downloaded via
# `scripts/download_model.py` (see backend/README or Dockerfile).
MODEL_PATH = os.environ.get(
    "POSE_MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "..", "..", "models", "pose_landmarker_lite.task"),
)

# BlazePose landmark indices (unchanged between the legacy `solutions` API
# and the current Tasks API — both emit the same 33-point topology).
LEFT_ANKLE = 27
RIGHT_ANKLE = 28
LEFT_HIP = 23
RIGHT_HIP = 24
LEFT_KNEE = 25
RIGHT_KNEE = 26
NOSE = 0


@dataclass
class FrameLandmarks:
    frame_index: int
    landmarks: np.ndarray | None  # shape (33, 4): x, y, z, visibility (normalized)


@dataclass
class JumpMetrics:
    jump_height_cm: float | None
    jump_distance_cm: float | None
    keyframes: list[Keyframe]
    coaching_feedback: str
    analysis_confidence: float


def run_pose_estimation(frames: list[np.ndarray], fps: float) -> list[FrameLandmarks]:
    """Run MediaPipe PoseLandmarker (Tasks API) on each frame and collect
    normalized landmarks."""
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"PoseLandmarker model not found at {MODEL_PATH}. Run "
            "`python scripts/download_model.py` to fetch it."
        )

    options = mp_vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=mp_vision.RunningMode.VIDEO,
        min_pose_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    frame_duration_ms = 1000.0 / fps if fps > 0 else 33.0
    results: list[FrameLandmarks] = []

    with mp_vision.PoseLandmarker.create_from_options(options) as landmarker:
        for idx, frame in enumerate(frames):
            rgb = frame[:, :, ::-1]
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
            timestamp_ms = int(idx * frame_duration_ms)
            result = landmarker.detect_for_video(mp_image, timestamp_ms)
            if result.pose_landmarks:
                points = result.pose_landmarks[0]
                lm = np.array(
                    [[p.x, p.y, p.z, p.visibility] for p in points],
                    dtype=np.float32,
                )
            else:
                lm = None
            results.append(FrameLandmarks(frame_index=idx, landmarks=lm))
    return results


def _ankle_y(landmarks: np.ndarray) -> float:
    """Average normalized y-position of both ankles (lower y = higher up in frame)."""
    return float((landmarks[LEFT_ANKLE, 1] + landmarks[RIGHT_ANKLE, 1]) / 2.0)


def _hip_y(landmarks: np.ndarray) -> float:
    return float((landmarks[LEFT_HIP, 1] + landmarks[RIGHT_HIP, 1]) / 2.0)


def _knee_angle_proxy(landmarks: np.ndarray) -> float:
    """Rough knee bend proxy: vertical distance between hip and knee normalized
    against hip-to-ankle distance. Smaller values indicate deeper knee bend."""
    hip_y = _hip_y(landmarks)
    knee_y = float((landmarks[LEFT_KNEE, 1] + landmarks[RIGHT_KNEE, 1]) / 2.0)
    ankle_y = _ankle_y(landmarks)
    span = max(ankle_y - hip_y, 1e-6)
    return (knee_y - hip_y) / span


def analyze_jump(
    frame_landmarks: list[FrameLandmarks],
    fps: float,
    frame_height_px: int,
    user_height_cm: float,
) -> JumpMetrics:
    """Detect keyframes and estimate jump height/distance from tracked ankle motion."""
    valid = [f for f in frame_landmarks if f.landmarks is not None]
    detection_rate = len(valid) / len(frame_landmarks) if frame_landmarks else 0.0

    if len(valid) < 5:
        return JumpMetrics(
            jump_height_cm=None,
            jump_distance_cm=None,
            keyframes=[],
            coaching_feedback=(
                "We couldn't reliably detect your body in this video. Try recording "
                "with better lighting, a plain background, and your full body in frame."
            ),
            analysis_confidence=round(detection_rate, 2),
        )

    ankle_y_series = np.array([_ankle_y(f.landmarks) for f in valid])
    frame_indices = np.array([f.frame_index for f in valid])

    # Smooth to reduce landmark jitter before differentiating.
    smoothed = _moving_average(ankle_y_series, window=3)

    standing_y = float(np.median(smoothed[: max(1, len(smoothed) // 4)]))
    peak_idx_local = int(np.argmin(smoothed))  # min y == highest point in frame
    peak_y = float(smoothed[peak_idx_local])

    # Loading phase: local max ankle_y (deepest crouch) before the peak.
    pre_peak = smoothed[: peak_idx_local + 1] if peak_idx_local > 0 else smoothed[:1]
    loading_idx_local = int(np.argmax(pre_peak))

    # Landing: first frame after peak where ankle_y returns near standing level.
    post_peak = smoothed[peak_idx_local:]
    landing_offset = _find_landing_offset(post_peak, standing_y)
    landing_idx_local = peak_idx_local + landing_offset

    # Takeoff / penultimate step approximated as midpoint between loading and peak.
    penultimate_idx_local = loading_idx_local + max(1, (peak_idx_local - loading_idx_local) // 2)

    keyframes = _build_keyframes(
        {
            KeyframeType.LOADING: loading_idx_local,
            KeyframeType.PENULTIMATE_STEP: penultimate_idx_local,
            KeyframeType.PEAK: peak_idx_local,
            KeyframeType.LANDING: min(landing_idx_local, len(smoothed) - 1),
        },
        frame_indices,
        fps,
    )

    # Calibration: use the standing pose's hip-to-ankle span as a proxy for the
    # user's known height to convert normalized pixel displacement to cm.
    standing_landmarks = valid[int(np.argmin(np.abs(frame_indices - frame_indices[0])))].landmarks
    px_per_cm = _estimate_px_per_cm(standing_landmarks, user_height_cm)

    vertical_displacement_norm = max(standing_y - peak_y, 0.0)
    jump_height_cm = None
    if px_per_cm > 0:
        jump_height_cm = round((vertical_displacement_norm * frame_height_px) / px_per_cm, 1)

    knee_bend = _knee_angle_proxy(valid[loading_idx_local].landmarks)
    feedback = _generate_feedback(jump_height_cm, knee_bend)

    return JumpMetrics(
        jump_height_cm=jump_height_cm,
        jump_distance_cm=None,  # Broad jump distance requires horizontal calibration (e.g. a reference marker); not estimated yet.
        keyframes=keyframes,
        coaching_feedback=feedback,
        analysis_confidence=round(detection_rate, 2),
    )


def _moving_average(series: np.ndarray, window: int) -> np.ndarray:
    if len(series) < window:
        return series
    kernel = np.ones(window) / window
    return np.convolve(series, kernel, mode="same")


def _find_landing_offset(post_peak: np.ndarray, standing_y: float) -> int:
    for i, y in enumerate(post_peak):
        if y >= standing_y * 0.97:
            return i
    return len(post_peak) - 1


def _build_keyframes(
    indices_by_type: dict[KeyframeType, int],
    frame_indices: np.ndarray,
    fps: float,
) -> list[Keyframe]:
    keyframes = []
    for kf_type, local_idx in indices_by_type.items():
        local_idx = max(0, min(local_idx, len(frame_indices) - 1))
        frame_no = int(frame_indices[local_idx])
        timestamp_ms = int((frame_no / fps) * 1000) if fps > 0 else 0
        keyframes.append(Keyframe(frame=frame_no, type=kf_type, timestamp_ms=timestamp_ms))
    return sorted(keyframes, key=lambda k: k.frame)


def _estimate_px_per_cm(landmarks: np.ndarray, user_height_cm: float) -> float:
    """Approximate pixels-per-cm using nose-to-ankle span as a stand-in for
    full body height (normalized coordinates, so this returns a normalized
    "unit per cm" scale, not literal pixels)."""
    nose_y = float(landmarks[NOSE, 1])
    ankle_y = _ankle_y(landmarks)
    body_span_norm = max(ankle_y - nose_y, 1e-6)
    # body_span_norm (normalized 0-1) approximates ~95% of full standing height.
    approx_height_norm = body_span_norm / 0.95
    return approx_height_norm / user_height_cm if user_height_cm > 0 else 0.0


def _generate_feedback(jump_height_cm: float | None, knee_bend: float) -> str:
    parts = []
    if jump_height_cm is not None:
        parts.append(f"Estimated jump height: {jump_height_cm:.1f} cm.")
    if knee_bend < 0.3:
        parts.append("Try bending your knees more during the loading phase to generate more power.")
    elif knee_bend > 0.6:
        parts.append("Good deep knee bend on takeoff.")
    else:
        parts.append("Good knee bend on takeoff. Try to achieve more height by extending fully through your hips.")
    return " ".join(parts)
