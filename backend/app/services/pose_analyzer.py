"""MediaPipe Pose-based analysis of a jump video.

Pipeline: run MediaPipe Pose on every frame to get 33 body landmarks,
track vertical ankle position over time to find the loading/takeoff/peak/
landing keyframes, then convert pixel displacement to real-world
centimeters using the user's known height as a calibration reference.
"""
from __future__ import annotations

import base64
import logging
import os
from dataclasses import dataclass

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

from app.models.schemas import DebugInfo, JumpType, Keyframe, KeyframeType

logger = logging.getLogger(__name__)

# Standard 33-point BlazePose topology edges, for drawing the skeleton overlay.
POSE_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 7), (0, 4), (4, 5), (5, 6), (6, 8), (9, 10),
    (11, 12), (11, 13), (13, 15), (15, 17), (15, 19), (15, 21), (17, 19),
    (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),
    (11, 23), (12, 24), (23, 24), (23, 25), (24, 26), (25, 27), (26, 28),
    (27, 29), (28, 30), (29, 31), (30, 32), (27, 31), (28, 32),
]

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
    debug: DebugInfo | None = None


def draw_skeleton(frame: np.ndarray, landmarks: np.ndarray) -> np.ndarray:
    """Draws the 33 pose landmarks and their connecting edges on a copy of the
    given BGR frame, for visual debugging."""
    annotated = frame.copy()
    h, w = annotated.shape[:2]

    def to_px(idx: int) -> tuple[int, int]:
        return int(landmarks[idx, 0] * w), int(landmarks[idx, 1] * h)

    for start_idx, end_idx in POSE_CONNECTIONS:
        cv2.line(annotated, to_px(start_idx), to_px(end_idx), (0, 255, 0), 2)

    for idx in range(landmarks.shape[0]):
        visibility = landmarks[idx, 3]
        color = (0, 0, 255) if visibility < 0.5 else (255, 0, 0)
        cv2.circle(annotated, to_px(idx), 4, color, -1)

    return annotated


def encode_frame_jpeg_b64(frame: np.ndarray) -> str | None:
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        return None
    return base64.b64encode(buf.tobytes()).decode("ascii")


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


def _ankle_x(landmarks: np.ndarray) -> float:
    """Average normalized x-position of both ankles, for broad-jump distance."""
    return float((landmarks[LEFT_ANKLE, 0] + landmarks[RIGHT_ANKLE, 0]) / 2.0)


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
    frame_width_px: int = 0,
    jump_type: JumpType = JumpType.VERTICAL,
    frames: list[np.ndarray] | None = None,
    include_debug: bool = False,
) -> JumpMetrics:
    """Detect keyframes and estimate jump height/distance from tracked ankle motion.

    Calibration: Uses the first ~half-second of standing frames to establish a stable
    px_per_cm scale, then applies it to the whole clip. This is more robust than
    using a single frame.

    Keyframe detection (loading/peak/landing) is always based on vertical ankle
    motion, since even a broad jump has a vertical arc. For broad jumps, distance
    is then measured as the horizontal ankle displacement between the standing
    (takeoff) position and the landing keyframe — this assumes a side-on camera
    angle where forward motion reads as horizontal motion in frame.
    """
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

    # Calibration: Use the standing phase (first ~0.5s before peak) to establish a
    # stable baseline scale. This is more robust than using a single frame.
    standing_frame_count = max(5, int(fps * 0.5))  # ~0.5 seconds or 5 frames min
    standing_landmarks_list = valid[:min(standing_frame_count, len(valid))]
    calibration = _compute_calibration(standing_landmarks_list, user_height_cm, frame_height_px)

    vertical_displacement_norm = max(standing_y - peak_y, 0.0)
    vertical_displacement_px = vertical_displacement_norm * frame_height_px
    jump_height_cm = None
    if calibration.px_per_cm > 0:
        jump_height_cm = round(vertical_displacement_px / calibration.px_per_cm, 1)

    # Broad jump distance: horizontal ankle displacement between the standing
    # (takeoff) position and the landing keyframe. x is normalized by frame
    # WIDTH (not height, unlike the vertical calibration above) — MediaPipe
    # normalizes x/y independently against each axis of the frame. px_per_cm
    # is still valid here since it's already in real (isotropic) pixels/cm.
    jump_distance_cm = None
    horizontal_displacement_norm = None
    horizontal_displacement_px = None
    if jump_type == JumpType.BROAD and calibration.px_per_cm > 0 and frame_width_px > 0:
        standing_x = float(np.mean([_ankle_x(f.landmarks) for f in standing_landmarks_list if f.landmarks is not None]))
        landing_landmarks = valid[min(landing_idx_local, len(valid) - 1)].landmarks
        landing_x = _ankle_x(landing_landmarks)
        horizontal_displacement_norm = abs(landing_x - standing_x)
        horizontal_displacement_px = horizontal_displacement_norm * frame_width_px
        jump_distance_cm = round(horizontal_displacement_px / calibration.px_per_cm, 1)

    knee_bend = _knee_angle_proxy(valid[loading_idx_local].landmarks)

    # Diagnose the "peak looks like standing" failure mode: MediaPipe drops a
    # frame entirely (no landmarks at all) when too much of the body is out of
    # frame, most often the head at the top of a jump. If a big tracking gap
    # sits right around our detected peak, the real peak was probably lost.
    headroom_norm = float(valid[0].landmarks[NOSE, 1])  # distance from frame top to head while standing
    largest_gap = _find_largest_tracking_gap(frame_landmarks)
    peak_frame_no = int(frame_indices[peak_idx_local])
    likely_missed_peak = (
        largest_gap is not None
        and largest_gap.length_frames >= 2
        and (largest_gap.start_frame - 3) <= peak_frame_no <= (largest_gap.end_frame + 3)
    )

    feedback = _generate_feedback(jump_height_cm, knee_bend, jump_type, jump_distance_cm)
    if likely_missed_peak:
        feedback += (
            " Heads up: tracking was lost for part of your jump (likely because you left the "
            "frame at the top), so the peak — and therefore the height estimate — may be "
            "inaccurate. Try stepping back so there's more headroom above you."
        )
    elif headroom_norm < 0.15:
        feedback += (
            " Heads up: there's not much space above your head in the starting frame. If you "
            "jump high enough to leave the frame, the height estimate could be inaccurate — "
            "try stepping back from the camera."
        )

    debug = None
    if include_debug:
        standing_frame_skeleton_b64 = None
        peak_frame_skeleton_b64 = None
        if frames is not None:
            standing_frame_idx = int(frame_indices[0])
            peak_frame_idx = int(frame_indices[peak_idx_local])
            standing_landmarks = valid[0].landmarks
            peak_landmarks = valid[peak_idx_local].landmarks
            if 0 <= standing_frame_idx < len(frames) and standing_landmarks is not None:
                annotated = draw_skeleton(frames[standing_frame_idx], standing_landmarks)
                standing_frame_skeleton_b64 = encode_frame_jpeg_b64(annotated)
            if 0 <= peak_frame_idx < len(frames) and peak_landmarks is not None:
                annotated = draw_skeleton(frames[peak_frame_idx], peak_landmarks)
                peak_frame_skeleton_b64 = encode_frame_jpeg_b64(annotated)

        calc_note = (
            f"({standing_y:.4f} - {peak_y:.4f}) x {frame_height_px}px = {vertical_displacement_px:.1f}px "
            f"displacement / {calibration.px_per_cm:.6f} px_per_cm = "
            f"{jump_height_cm if jump_height_cm is not None else 'N/A'} cm"
        )
        if jump_type == JumpType.BROAD and horizontal_displacement_px is not None:
            calc_note += (
                f" | horizontal: {horizontal_displacement_norm:.4f} x {frame_width_px}px = "
                f"{horizontal_displacement_px:.1f}px / {calibration.px_per_cm:.6f} px_per_cm = "
                f"{jump_distance_cm if jump_distance_cm is not None else 'N/A'} cm"
            )
        gap_frames = largest_gap.length_frames if largest_gap else 0
        gap_ms = (gap_frames / fps * 1000) if fps > 0 else 0.0
        debug = DebugInfo(
            detection_rate=round(detection_rate, 3),
            standing_frames_used=calibration.frames_used,
            standing_hip_y_norm=round(calibration.avg_hip_y, 4),
            standing_ankle_y_norm=round(calibration.avg_ankle_y, 4),
            hip_to_ankle_span_norm=round(calibration.avg_span, 4),
            estimated_px_per_cm=calibration.px_per_cm,
            standing_y_norm=round(standing_y, 4),
            peak_y_norm=round(peak_y, 4),
            vertical_displacement_norm=round(vertical_displacement_norm, 4),
            vertical_displacement_px=round(vertical_displacement_px, 1),
            calculation_note=calc_note,
            headroom_norm=round(headroom_norm, 4),
            largest_tracking_gap_frames=gap_frames,
            largest_tracking_gap_ms=round(gap_ms, 1),
            likely_missed_peak=likely_missed_peak,
            horizontal_displacement_norm=(
                round(horizontal_displacement_norm, 4) if horizontal_displacement_norm is not None else None
            ),
            horizontal_displacement_px=(
                round(horizontal_displacement_px, 1) if horizontal_displacement_px is not None else None
            ),
            standing_frame_skeleton_b64=standing_frame_skeleton_b64,
            peak_frame_skeleton_b64=peak_frame_skeleton_b64,
        )

    return JumpMetrics(
        jump_height_cm=jump_height_cm,
        jump_distance_cm=jump_distance_cm,
        keyframes=keyframes,
        coaching_feedback=feedback,
        analysis_confidence=round(detection_rate, 2),
        debug=debug,
    )


def _moving_average(series: np.ndarray, window: int) -> np.ndarray:
    """Box-filter smoothing with edge-replication padding.

    `np.convolve(..., mode="same")` on its own implicitly zero-pads the
    boundaries, which drags the first/last values toward zero — for y-position
    data in [0, 1], that fabricates a fake "high point" at the very start/end
    of every clip (exactly where a jump video's standing frames are). Padding
    with the edge value first avoids that artifact.
    """
    if len(series) < window:
        return series
    pad = window // 2
    padded = np.pad(series, (pad, window - 1 - pad), mode="edge")
    kernel = np.ones(window) / window
    return np.convolve(padded, kernel, mode="valid")


def _find_landing_offset(post_peak: np.ndarray, standing_y: float) -> int:
    for i, y in enumerate(post_peak):
        if y >= standing_y * 0.97:
            return i
    return len(post_peak) - 1


@dataclass
class TrackingGap:
    start_frame: int
    end_frame: int
    length_frames: int


def _find_largest_tracking_gap(frame_landmarks: list[FrameLandmarks]) -> TrackingGap | None:
    """Finds the longest run of consecutive frames with no detected body at all.

    A large gap right around the jump's peak usually means MediaPipe lost the
    subject entirely for those frames — most commonly because part of the body
    (often the head) left the top of the frame at the highest point of the jump.
    Those frames are silently excluded from peak detection, which can make an
    earlier, lower point look like the peak instead.
    """
    largest: TrackingGap | None = None
    run_start: int | None = None

    for i, f in enumerate(frame_landmarks):
        if f.landmarks is None:
            if run_start is None:
                run_start = i
        else:
            if run_start is not None:
                length = i - run_start
                if largest is None or length > largest.length_frames:
                    largest = TrackingGap(start_frame=run_start, end_frame=i - 1, length_frames=length)
                run_start = None

    if run_start is not None:
        length = len(frame_landmarks) - run_start
        if largest is None or length > largest.length_frames:
            largest = TrackingGap(start_frame=run_start, end_frame=len(frame_landmarks) - 1, length_frames=length)

    return largest


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


@dataclass
class CalibrationResult:
    px_per_cm: float
    avg_hip_y: float
    avg_ankle_y: float
    avg_span: float
    frames_used: int


def _compute_calibration(
    standing_landmarks_list: list[FrameLandmarks], user_height_cm: float, frame_height_px: int
) -> CalibrationResult:
    """Establish a stable px_per_cm scale by averaging across multiple standing frames.

    Uses hip-to-ankle span (more stable than nose-to-ankle) as a proxy for body height.
    Averages across ~0.5s of standing posture to reduce jitter.
    """
    hip_ys, ankle_ys, spans = [], [], []
    for frame_lm in standing_landmarks_list:
        if frame_lm.landmarks is None:
            continue
        hip_y = _hip_y(frame_lm.landmarks)
        ankle_y = _ankle_y(frame_lm.landmarks)
        hip_ys.append(hip_y)
        ankle_ys.append(ankle_y)
        spans.append(max(ankle_y - hip_y, 1e-6))

    if not spans:
        return CalibrationResult(px_per_cm=0.0, avg_hip_y=0.0, avg_ankle_y=0.0, avg_span=0.0, frames_used=0)

    avg_hip_y = float(np.mean(hip_ys))
    avg_ankle_y = float(np.mean(ankle_ys))
    avg_span = float(np.mean(spans))
    # avg_span (normalized 0-1, a fraction of frame height) approximates the
    # distance from hips to ankles, which is roughly 55% of full standing
    # height (from hips to top of head). Convert to actual pixels via
    # frame_height_px before dividing by user_height_cm — px_per_cm must be
    # in pixels/cm, not normalized-units/cm, or the later division against a
    # pixel displacement produces numbers off by a factor of frame_height_px.
    approx_height_norm = avg_span / 0.55
    approx_height_px = approx_height_norm * frame_height_px
    px_per_cm = approx_height_px / user_height_cm if user_height_cm > 0 else 0.0

    return CalibrationResult(
        px_per_cm=px_per_cm,
        avg_hip_y=avg_hip_y,
        avg_ankle_y=avg_ankle_y,
        avg_span=avg_span,
        frames_used=len(spans),
    )


def _generate_feedback(
    jump_height_cm: float | None,
    knee_bend: float,
    jump_type: JumpType = JumpType.VERTICAL,
    jump_distance_cm: float | None = None,
) -> str:
    parts = []
    if jump_type == JumpType.BROAD and jump_distance_cm is not None:
        parts.append(f"Estimated jump distance: {jump_distance_cm:.1f} cm.")
    elif jump_height_cm is not None:
        parts.append(f"Estimated jump height: {jump_height_cm:.1f} cm.")
    if knee_bend < 0.3:
        parts.append("Try bending your knees more during the loading phase to generate more power.")
    elif knee_bend > 0.6:
        parts.append("Good deep knee bend on takeoff.")
    else:
        parts.append("Good knee bend on takeoff. Try to achieve more height by extending fully through your hips.")
    return " ".join(parts)
