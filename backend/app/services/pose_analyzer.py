"""MediaPipe Pose-based analysis of a jump video.

Pipeline: run MediaPipe PoseLandmarker on every frame to get both the 2D
image-space landmarks and MediaPipe's 3D pose_world_landmarks (metric-scale,
hip-centered). 2D landmarks drive BOTH keyframe *timing* detection (which
frame is standing/peak/etc, based on normalized ankle position) AND the
actual height/distance *number* (pixel-calibration path, anchored to a fixed
point in the camera frame). 3D world landmarks drive joint-angle
biomechanics only (knee flexion, valgus, torso lean) — those are relative,
translation-invariant measurements, exactly what a hip-centered coordinate
system is good for.

World landmarks are NOT used for height/distance: since their origin moves
with the hips every frame, they structurally can't see whole-body
translation through space (confirmed against real footage — that path
returned an exact 0.0cm for a jump the 2D path correctly measured). The
world-landmark number is still computed and exposed in debug output as a
labeled comparison value, never as the primary estimate.
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

from app.models.schemas import (
    CameraSetupWarning,
    DebugInfo,
    JumpType,
    KeyframeAnalysis,
    KeyframeType,
)
from app.services import biomechanics, coaching_llm

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
LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12
LEFT_ANKLE = 27
RIGHT_ANKLE = 28
LEFT_HIP = 23
RIGHT_HIP = 24
LEFT_KNEE = 25
RIGHT_KNEE = 26
NOSE = 0

# Camera-setup validation thresholds. Like the biomechanics thresholds, these
# are reasonable starting points, not yet validated against real footage.
CAMERA_TILT_WARNING_DEG = 8.0
VERTICAL_JUMP_DRIFT_WARNING_CM = 40.0
MAX_ABSORPTION_SEARCH_SECONDS = 1.0

# Typical adult body proportions put the hip-to-ankle span at roughly 1.7x
# the shoulder-to-hip span (derived from standard anthropometric tables —
# Winter, "Biomechanics and Motor Control of Human Movement": shoulder
# ~81% of stature, hip ~53%, ankle ~4%). A camera pitched steeply up or
# down (not level with the body) introduces foreshortening that skews this
# ratio. The bounds below are intentionally generous, to allow for real
# person-to-person variation in leg/torso proportions and catch only
# pronounced pitch, not individual body shape — first-pass values, not yet
# validated against real mis-angled footage.
EXPECTED_HIP_ANKLE_TO_SHOULDER_HIP_RATIO_MIN = 1.0
EXPECTED_HIP_ANKLE_TO_SHOULDER_HIP_RATIO_MAX = 2.6

# Peak detection takes the extreme (min) ankle-y across a window, which
# makes it very sensitive to a single bad frame — a blurry or self-occluded
# ankle (common right at the top of a jump) can report a spuriously extreme
# position that isn't real, and get mistaken for the true peak. Below this,
# MediaPipe's own visibility score means the position probably isn't
# trustworthy. First-pass value, not yet tuned against real footage.
ANKLE_VISIBILITY_MIN = 0.5

# How far back before takeoff to search for the deepest counter-movement
# crouch. Like MAX_ABSORPTION_SEARCH_SECONDS, a first-pass value — a real
# crouch is typically under a second, this gives some margin.
MAX_ANTICIPATION_SEARCH_SECONDS = 1.5


@dataclass
class FrameLandmarks:
    frame_index: int
    landmarks: np.ndarray | None  # shape (33, 4): x, y, z, visibility (image-normalized)
    world_landmarks: np.ndarray | None = None  # shape (33, 3): x, y, z in meters, hip-centered


@dataclass
class JumpMetrics:
    jump_height_cm: float | None
    jump_distance_cm: float | None
    keyframe_analyses: list[KeyframeAnalysis]
    coaching_feedback: str
    analysis_confidence: float
    camera_warnings: list[CameraSetupWarning]
    debug: DebugInfo | None = None


# Landmarks that actually feed a measurement or a coaching-feedback signal
# (ankle: height/distance; hip: calibration, drift, pitch; knee: flexion,
# valgus, anticipation/takeoff/absorption timing; shoulder: torso lean,
# tilt, pitch) — drawn larger so it's visually obvious which points are
# driving the numbers, versus the rest of the skeleton drawn for context.
KEY_LANDMARK_INDICES = {
    LEFT_ANKLE, RIGHT_ANKLE, LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE, LEFT_SHOULDER, RIGHT_SHOULDER,
}
KEY_LANDMARK_RADIUS_PX = 9
DEFAULT_LANDMARK_RADIUS_PX = 4


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
        radius = KEY_LANDMARK_RADIUS_PX if idx in KEY_LANDMARK_INDICES else DEFAULT_LANDMARK_RADIUS_PX
        cv2.circle(annotated, to_px(idx), radius, color, -1)

    return annotated


def draw_height_marker(frame: np.ndarray, standing_y_norm: float, peak_y_norm: float, height_cm: float) -> np.ndarray:
    """Draws a visual reference for the measured jump height on the peak
    frame: a line at standing ankle height, a line at peak ankle height, and
    a labeled double-headed arrow spanning the two."""
    annotated = frame.copy()
    h, w = annotated.shape[:2]
    standing_y_px = int(standing_y_norm * h)
    peak_y_px = int(peak_y_norm * h)

    color = (0, 0, 255)  # BGR bright red — stands out against the green skeleton overlay
    thickness = 5
    line_x_start, line_x_end = int(w * 0.05), int(w * 0.35)
    arrow_x = int(w * 0.20)

    cv2.line(annotated, (line_x_start, standing_y_px), (line_x_end, standing_y_px), color, thickness, cv2.LINE_AA)
    cv2.line(annotated, (line_x_start, peak_y_px), (line_x_end, peak_y_px), color, thickness, cv2.LINE_AA)
    cv2.arrowedLine(
        annotated, (arrow_x, standing_y_px), (arrow_x, peak_y_px), color, thickness, cv2.LINE_AA, tipLength=0.15
    )
    cv2.arrowedLine(
        annotated, (arrow_x, peak_y_px), (arrow_x, standing_y_px), color, thickness, cv2.LINE_AA, tipLength=0.15
    )

    label = f"{height_cm:.1f} cm"
    label_pos = (line_x_end + 8, (standing_y_px + peak_y_px) // 2 + 5)
    # Black outline underneath so the label stays legible over any background.
    cv2.putText(annotated, label, label_pos, cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 4, cv2.LINE_AA)
    cv2.putText(annotated, label, label_pos, cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2, cv2.LINE_AA)

    return annotated


def encode_frame_jpeg_b64(frame: np.ndarray) -> str | None:
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        return None
    return base64.b64encode(buf.tobytes()).decode("ascii")


def run_pose_estimation(frames: list[np.ndarray], fps: float) -> list[FrameLandmarks]:
    """Run MediaPipe PoseLandmarker (Tasks API) on each frame and collect
    both 2D image-space and 3D world-space landmarks."""
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

            lm = None
            world_lm = None
            if result.pose_landmarks:
                points = result.pose_landmarks[0]
                lm = np.array([[p.x, p.y, p.z, p.visibility] for p in points], dtype=np.float32)
            if result.pose_world_landmarks:
                world_points = result.pose_world_landmarks[0]
                world_lm = np.array([[p.x, p.y, p.z] for p in world_points], dtype=np.float32)

            results.append(FrameLandmarks(frame_index=idx, landmarks=lm, world_landmarks=world_lm))
    return results


def _ankle_y(landmarks: np.ndarray) -> float:
    """Average normalized y-position of both ankles (lower y = higher up in frame)."""
    return float((landmarks[LEFT_ANKLE, 1] + landmarks[RIGHT_ANKLE, 1]) / 2.0)


def _ankle_x(landmarks: np.ndarray) -> float:
    """Average normalized x-position of both ankles, for broad-jump distance."""
    return float((landmarks[LEFT_ANKLE, 0] + landmarks[RIGHT_ANKLE, 0]) / 2.0)


def _hip_x(landmarks: np.ndarray) -> float:
    return float((landmarks[LEFT_HIP, 0] + landmarks[RIGHT_HIP, 0]) / 2.0)


def _ankle_visibility(landmarks: np.ndarray) -> float:
    """Average visibility score of both ankles — how confident MediaPipe is
    that this landmark position is real, not a blurry/occluded guess."""
    return float((landmarks[LEFT_ANKLE, 3] + landmarks[RIGHT_ANKLE, 3]) / 2.0)


def _hip_y(landmarks: np.ndarray) -> float:
    return float((landmarks[LEFT_HIP, 1] + landmarks[RIGHT_HIP, 1]) / 2.0)


def _shoulder_y(landmarks: np.ndarray) -> float:
    return float((landmarks[LEFT_SHOULDER, 1] + landmarks[RIGHT_SHOULDER, 1]) / 2.0)


def _ankle_y_world(world_landmarks: np.ndarray) -> float:
    return float((world_landmarks[LEFT_ANKLE, 1] + world_landmarks[RIGHT_ANKLE, 1]) / 2.0)


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
    """Detects the 6 jump stages and estimates jump height/distance from
    tracked ankle motion.

    Calibration: uses the first ~half-second of standing frames to establish
    a stable baseline, then applies it to the whole clip. Height/distance
    prefer MediaPipe's 3D world landmarks when available (see module
    docstring); the legacy 2D pixel-calibration path is the fallback.

    Keyframe timing (initiation/max_anticipation/peak/touchdown) is based on
    2D vertical ankle motion, since even a broad jump has a vertical arc.
    Takeoff and max_absorption are detected from the knee-flexion angle
    series (most extended leg just before becoming airborne; most bent knee
    shortly after landing). For broad jumps, distance is the horizontal
    ankle displacement between standing and touchdown — this assumes a
    side-on camera angle where forward motion reads as horizontal motion.
    """
    valid = [f for f in frame_landmarks if f.landmarks is not None]
    detection_rate = len(valid) / len(frame_landmarks) if frame_landmarks else 0.0

    if len(valid) < 5:
        return JumpMetrics(
            jump_height_cm=None,
            jump_distance_cm=None,
            keyframe_analyses=[],
            coaching_feedback=(
                "We couldn't reliably detect your body in this video. Try recording "
                "with better lighting, a plain background, and your full body in frame."
            ),
            analysis_confidence=round(detection_rate, 2),
            camera_warnings=[],
        )

    ankle_y_series = np.array([_ankle_y(f.landmarks) for f in valid])
    ankle_visibility_series = np.array([_ankle_visibility(f.landmarks) for f in valid])
    frame_indices = np.array([f.frame_index for f in valid])

    # A single blurry/self-occluded ankle reading (low MediaPipe visibility)
    # can otherwise be mistaken for the true jump apex, AND contaminate the
    # smoothed value of its neighboring frames too via the moving average
    # below — so clean it out before smoothing, not after, by interpolating
    # from nearby reliable frames. Falls back to the raw series untouched if
    # visibility data is uniformly poor for this whole clip (nothing more
    # reliable to interpolate from).
    cleaned_ankle_y_series = _clean_unreliable_samples(
        ankle_y_series, ankle_visibility_series, ANKLE_VISIBILITY_MIN
    )

    # Smooth to reduce landmark jitter before differentiating.
    smoothed = _moving_average(cleaned_ankle_y_series, window=3)

    standing_y = float(np.median(smoothed[: max(1, len(smoothed) // 4)]))
    peak_idx_local = int(np.argmin(smoothed))  # min y == highest point in frame
    peak_y = float(smoothed[peak_idx_local])

    # Takeoff: last frame before the peak still near standing height. The
    # ankle barely moves while the foot is planted, so this is the same
    # "return to baseline" signal touchdown already uses below — just
    # applied backward from the peak instead of forward.
    #
    # (Previously used peak knee extension instead, but a fully-extended leg
    # can occur well into the airborne phase, not necessarily at the instant
    # of leaving the ground. Confirmed against a real clip where that put
    # "takeoff" 9 frames after the ankle-y curve showed smooth, continuous
    # parabolic deceleration — i.e. already mid-flight, not still grounded.)
    pre_peak = smoothed[: peak_idx_local + 1]
    takeoff_offset = _find_landing_offset(pre_peak[::-1], standing_y)
    takeoff_idx_local = max(peak_idx_local - takeoff_offset, 0)

    # Touchdown: first frame after peak where ankle_y returns near standing level.
    post_peak = smoothed[peak_idx_local:]
    landing_offset = _find_landing_offset(post_peak, standing_y)
    touchdown_idx_local = min(peak_idx_local + landing_offset, len(smoothed) - 1)

    # Knee-flexion series (3D world landmarks preferred, 2D fallback) drives
    # anticipation/max_absorption detection AND the per-keyframe biomechanics.
    knee_flexion_series: list[float | None] = []
    for f in valid:
        angle = biomechanics.knee_flexion_deg(f.world_landmarks)
        if angle is None:
            angle = biomechanics.knee_flexion_deg_2d_fallback(f.landmarks)
        knee_flexion_series.append(angle)

    # Max anticipation: deepest knee bend (most bent = lowest flexion angle)
    # in a bounded window before takeoff. Ankle-y can't localize this — the
    # ankle doesn't move during a crouch (only the knee/hip bend while the
    # foot stays planted), so searching it across the whole pre-takeoff clip
    # picked up meaningless jitter far from the actual jump on a real clip.
    anticipation_search_start = max(0, takeoff_idx_local - int(fps * MAX_ANTICIPATION_SEARCH_SECONDS))
    max_anticipation_idx_local = _argmin_in_window(
        knee_flexion_series, anticipation_search_start, takeoff_idx_local,
        fallback=max(0, takeoff_idx_local - 1),
    )

    absorption_search_end = min(touchdown_idx_local + int(fps * MAX_ABSORPTION_SEARCH_SECONDS), len(valid) - 1)
    max_absorption_idx_local = _argmin_in_window(
        knee_flexion_series, touchdown_idx_local, absorption_search_end, fallback=touchdown_idx_local
    )

    stage_indices: dict[KeyframeType, int] = {
        KeyframeType.INITIATION: 0,
        KeyframeType.MAX_ANTICIPATION: max_anticipation_idx_local,
        KeyframeType.TAKEOFF: takeoff_idx_local,
        KeyframeType.PEAK: peak_idx_local,
        KeyframeType.TOUCHDOWN: touchdown_idx_local,
        KeyframeType.MAX_ABSORPTION: max_absorption_idx_local,
    }

    # Calibration: average across ~0.5s of standing posture for a stable baseline.
    standing_frame_count = max(5, int(fps * 0.5))
    standing_landmarks_list = valid[: min(standing_frame_count, len(valid))]
    calibration = _compute_calibration(standing_landmarks_list, user_height_cm, frame_height_px)

    camera_warnings = _check_camera_setup(
        standing_landmarks_list, valid, jump_type, calibration.px_per_cm, frame_width_px
    )

    jump_height_cm, jump_height_cm_world = _estimate_vertical_height(
        standing_landmarks_list, valid[peak_idx_local], standing_y, peak_y, frame_height_px, calibration
    )

    jump_distance_cm = None
    horizontal_displacement_norm = None
    horizontal_displacement_px = None
    if jump_type == JumpType.BROAD:
        jump_distance_cm, horizontal_displacement_norm, horizontal_displacement_px = _estimate_broad_distance(
            standing_landmarks_list, valid[touchdown_idx_local], frame_width_px, calibration
        )

    # Diagnose the "peak looks like standing" failure mode: MediaPipe drops a
    # frame entirely (no landmarks at all) when too much of the body is out of
    # frame, most often the head at the top of a jump.
    headroom_norm = float(valid[0].landmarks[NOSE, 1])
    largest_gap = _find_largest_tracking_gap(frame_landmarks)
    peak_frame_no = int(frame_indices[peak_idx_local])
    likely_missed_peak = (
        largest_gap is not None
        and largest_gap.length_frames >= 2
        and (largest_gap.start_frame - 3) <= peak_frame_no <= (largest_gap.end_frame + 3)
    )

    keyframe_analyses = _build_keyframe_analyses(
        stage_indices, valid, fps, frames, jump_type, standing_y, peak_y, jump_height_cm
    )

    summary_feedback = _generate_summary_feedback(jump_height_cm, jump_type, jump_distance_cm)
    if likely_missed_peak:
        summary_feedback += (
            " Heads up: tracking was lost for part of your jump (likely because you left the "
            "frame at the top), so the peak — and therefore the height estimate — may be "
            "inaccurate. Try stepping back so there's more headroom above you."
        )
    elif headroom_norm < 0.15:
        summary_feedback += (
            " Heads up: there's not much space above your head in the starting frame. If you "
            "jump high enough to leave the frame, the height estimate could be inaccurate — "
            "try stepping back from the camera."
        )

    debug = None
    if include_debug:
        vertical_displacement_norm = max(standing_y - peak_y, 0.0)
        vertical_displacement_px = vertical_displacement_norm * frame_height_px
        calc_note = (
            f"2D pixel-calibration height (primary): ({standing_y:.4f} - {peak_y:.4f}) x {frame_height_px}px = "
            f"{vertical_displacement_px:.1f}px / {calibration.px_per_cm:.6f} px_per_cm = "
            f"{jump_height_cm if jump_height_cm is not None else 'N/A'} cm | "
            f"world-landmark comparison (unreliable, hip-relative): "
            f"{jump_height_cm_world if jump_height_cm_world is not None else 'N/A'} cm"
        )
        if jump_type == JumpType.BROAD and horizontal_displacement_px is not None:
            calc_note += f" | horizontal: {horizontal_displacement_px:.1f}px -> {jump_distance_cm} cm"

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
            jump_height_cm_world_landmarks_comparison=jump_height_cm_world,
        )

    return JumpMetrics(
        jump_height_cm=jump_height_cm,
        jump_distance_cm=jump_distance_cm,
        keyframe_analyses=keyframe_analyses,
        coaching_feedback=summary_feedback,
        analysis_confidence=round(detection_rate, 2),
        camera_warnings=camera_warnings,
        debug=debug,
    )


def _argmin_in_window(series: list[float | None], start: int, end: int, fallback: int) -> int:
    window = [(i, v) for i, v in enumerate(series[start : end + 1]) if v is not None]
    if not window:
        return fallback
    rel_idx, _ = min(window, key=lambda pair: pair[1])
    return start + rel_idx


def _estimate_vertical_height(
    standing_landmarks_list: list[FrameLandmarks],
    peak_frame: FrameLandmarks,
    standing_y: float,
    peak_y: float,
    frame_height_px: int,
    calibration: "CalibrationResult",
) -> tuple[float | None, float | None]:
    """Returns (jump_height_cm, jump_height_cm_world_landmarks_comparison).

    Height is measured via the 2D pixel-calibration path, anchored to a
    fixed point in the camera frame — the only way to actually see
    whole-body translation through space.

    MediaPipe's pose_world_landmarks are NOT usable for this: they're
    defined relative to the hip center, which moves WITH the body every
    frame. During a real vertical jump the hip and ankle translate upward
    together, so the ankle's position relative to the (also-moving) hip
    barely changes — world landmarks are excellent for joint-angle
    biomechanics (a relative, translation-invariant measurement) but
    structurally cannot see whole-body translation. Confirmed against real
    footage: this path returned an exact 0.0cm for a jump the 2D path
    correctly measured. Still computed and returned here as a labeled debug
    comparison value, never as the primary estimate.
    """
    jump_height_cm = None
    if calibration.px_per_cm > 0:
        vertical_displacement_px = max(standing_y - peak_y, 0.0) * frame_height_px
        jump_height_cm = round(vertical_displacement_px / calibration.px_per_cm, 1)

    jump_height_cm_world = None
    standing_world = [f.world_landmarks for f in standing_landmarks_list if f.world_landmarks is not None]
    if standing_world and peak_frame.world_landmarks is not None:
        standing_ankle_world_y = float(np.mean([_ankle_y_world(w) for w in standing_world]))
        peak_ankle_world_y = _ankle_y_world(peak_frame.world_landmarks)
        displacement_m = max(standing_ankle_world_y - peak_ankle_world_y, 0.0)
        jump_height_cm_world = round(displacement_m * 100, 1)

    return jump_height_cm, jump_height_cm_world


def _estimate_broad_distance(
    standing_landmarks_list: list[FrameLandmarks],
    touchdown_frame: FrameLandmarks,
    frame_width_px: int,
    calibration: "CalibrationResult",
) -> tuple[float | None, float | None, float | None]:
    """Returns (jump_distance_cm, horizontal_displacement_norm, horizontal_displacement_px).

    Uses the 2D pixel-calibration path only — see _estimate_vertical_height's
    docstring for why world landmarks (hip-relative) can't measure
    whole-body translation, which applies identically to horizontal
    displacement.
    """
    if calibration.px_per_cm > 0 and frame_width_px > 0:
        standing_x = float(np.mean([_ankle_x(f.landmarks) for f in standing_landmarks_list if f.landmarks is not None]))
        touchdown_x = _ankle_x(touchdown_frame.landmarks)
        horizontal_displacement_norm = abs(touchdown_x - standing_x)
        horizontal_displacement_px = horizontal_displacement_norm * frame_width_px
        jump_distance_cm = round(horizontal_displacement_px / calibration.px_per_cm, 1)
        return jump_distance_cm, horizontal_displacement_norm, horizontal_displacement_px

    return None, None, None


def _check_camera_setup(
    standing_landmarks_list: list[FrameLandmarks],
    valid: list[FrameLandmarks],
    jump_type: JumpType,
    px_per_cm: float,
    frame_width_px: int,
) -> list[CameraSetupWarning]:
    """Flags likely-bad-setup conditions instead of silently returning a
    number that's probably wrong. See CAMERA_TILT_WARNING_DEG /
    VERTICAL_JUMP_DRIFT_WARNING_CM docstrings — first-pass thresholds."""
    warnings: list[CameraSetupWarning] = []

    if standing_landmarks_list and standing_landmarks_list[0].landmarks is not None:
        tilt_deg = _camera_tilt_deg(standing_landmarks_list[0].landmarks)
        if abs(tilt_deg) > CAMERA_TILT_WARNING_DEG:
            warnings.append(
                CameraSetupWarning(
                    code="camera_tilt",
                    message=(
                        "The camera looks tilted rather than level, which can throw off the "
                        "height/distance estimate. Try leveling it and re-recording."
                    ),
                )
            )

    standing_with_landmarks = [f.landmarks for f in standing_landmarks_list if f.landmarks is not None]
    if standing_with_landmarks:
        shoulder_hip_span = abs(
            float(np.mean([_hip_y(lm) for lm in standing_with_landmarks]))
            - float(np.mean([_shoulder_y(lm) for lm in standing_with_landmarks]))
        )
        hip_ankle_span = abs(
            float(np.mean([_ankle_y(lm) for lm in standing_with_landmarks]))
            - float(np.mean([_hip_y(lm) for lm in standing_with_landmarks]))
        )
        if shoulder_hip_span > 1e-6:
            ratio = hip_ankle_span / shoulder_hip_span
            if not (
                EXPECTED_HIP_ANKLE_TO_SHOULDER_HIP_RATIO_MIN
                <= ratio
                <= EXPECTED_HIP_ANKLE_TO_SHOULDER_HIP_RATIO_MAX
            ):
                warnings.append(
                    CameraSetupWarning(
                        code="camera_pitch",
                        message=(
                            "The camera may be angled up or down rather than level with your body, "
                            "which can distort the height/distance estimate. Try positioning the "
                            "camera at roughly hip height, pointed straight ahead."
                        ),
                    )
                )

    if jump_type == JumpType.VERTICAL and px_per_cm > 0 and frame_width_px > 0:
        hip_x_series = np.array([_hip_x(f.landmarks) for f in valid])
        drift_norm = float(np.max(hip_x_series) - np.min(hip_x_series))
        drift_cm = (drift_norm * frame_width_px) / px_per_cm
        if drift_cm > VERTICAL_JUMP_DRIFT_WARNING_CM:
            warnings.append(
                CameraSetupWarning(
                    code="horizontal_drift",
                    message=(
                        "Significant side-to-side movement was detected during what should be a "
                        "straight-up vertical jump, which may make the height estimate unreliable. "
                        "This works best for a jump straight up in place, not a running or traveling jump."
                    ),
                )
            )

    return warnings


def _camera_tilt_deg(standing_landmarks: np.ndarray) -> float:
    """Shoulder line's tilt from horizontal, in degrees, using 2D image-space landmarks."""
    left = standing_landmarks[LEFT_SHOULDER, :2]
    right = standing_landmarks[RIGHT_SHOULDER, :2]
    return float(np.degrees(np.arctan2(right[1] - left[1], right[0] - left[0])))


def _build_keyframe_analyses(
    stage_indices: dict[KeyframeType, int],
    valid: list[FrameLandmarks],
    fps: float,
    frames: list[np.ndarray] | None,
    jump_type: JumpType,
    standing_y: float,
    peak_y: float,
    jump_height_cm: float | None,
) -> list[KeyframeAnalysis]:
    analyses: list[KeyframeAnalysis] = []
    for kf_type, local_idx in stage_indices.items():
        local_idx = max(0, min(local_idx, len(valid) - 1))
        frame_lm = valid[local_idx]
        frame_no = frame_lm.frame_index
        timestamp_ms = int((frame_no / fps) * 1000) if fps > 0 else 0

        metrics = biomechanics.compute_keyframe_metrics(kf_type, frame_lm.world_landmarks)

        image_b64 = None
        if frames is not None and 0 <= frame_no < len(frames) and frame_lm.landmarks is not None:
            annotated = draw_skeleton(frames[frame_no], frame_lm.landmarks)
            # A visual marker of the measured height only makes sense on the
            # peak frame of a vertical jump, and only once we actually have
            # a number to show. Uses the same (smoothed) standing_y/peak_y
            # the actual jump_height_cm was computed from, so the drawn
            # marker always matches the reported number.
            if kf_type == KeyframeType.PEAK and jump_type == JumpType.VERTICAL and jump_height_cm is not None:
                annotated = draw_height_marker(annotated, standing_y, peak_y, jump_height_cm)
            image_b64 = encode_frame_jpeg_b64(annotated)

        feedback = coaching_llm.generate_stage_feedback(kf_type, metrics)

        analyses.append(
            KeyframeAnalysis(
                type=kf_type,
                frame=frame_no,
                timestamp_ms=timestamp_ms,
                image_b64=image_b64,
                metrics=metrics,
                feedback=feedback,
            )
        )

    analyses.sort(key=lambda k: k.frame)
    return analyses


def _clean_unreliable_samples(series: np.ndarray, visibility: np.ndarray, min_visibility: float) -> np.ndarray:
    """Replaces samples below `min_visibility` with a linear interpolation
    from the nearest reliable neighbors, so a single low-confidence landmark
    reading can't skew an extremum search OR bleed into a neighboring
    frame's smoothed value via a moving average applied afterward.

    Returns the series unchanged if every sample is reliable (the common
    case — this is a no-op then) or if none are (nothing reliable to
    interpolate from, so trusting the raw data is the best remaining option).
    """
    reliable = visibility >= min_visibility
    if reliable.all() or not reliable.any():
        return series
    indices = np.arange(len(series))
    return np.interp(indices, indices[reliable], series[reliable])


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
    Averages across ~0.5s of standing posture to reduce jitter. This is the legacy 2D
    fallback path — see module docstring — kept because it's cheap, already well-tested,
    and still needed when world landmarks aren't available for a clip.
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


def _generate_summary_feedback(
    jump_height_cm: float | None,
    jump_type: JumpType = JumpType.VERTICAL,
    jump_distance_cm: float | None = None,
) -> str:
    if jump_type == JumpType.BROAD and jump_distance_cm is not None:
        return f"Estimated jump distance: {jump_distance_cm:.1f} cm. See the stage-by-stage breakdown below for form feedback."
    if jump_height_cm is not None:
        return f"Estimated jump height: {jump_height_cm:.1f} cm. See the stage-by-stage breakdown below for form feedback."
    return "Couldn't compute a height/distance estimate for this jump. See the stage-by-stage breakdown below for what was tracked."
