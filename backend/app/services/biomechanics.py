"""Joint-angle math and rule-based form checks.

This is the deterministic "knowledge base" layer: every number here comes
from vector geometry on tracked landmarks, and every "concern" flag comes
from a fixed threshold. Nothing here is learned or guessed by a model — the
coaching LLM (see coaching_llm.py) only ever paraphrases what this module
computes, it never judges form on its own.

The joint-angle math itself is verified with synthetic geometric test cases
(a known-straight leg must read ~180 degrees, a known-90-degree bend must
read ~90, etc.) — see tests/test_biomechanics.py. The specific thresholds
below (what counts as "elevated" knee valgus, how much camera tilt matters)
are reasonable starting points from general strength-and-conditioning
knowledge, not validated against real jump footage yet. If real coaching
guidelines or measured footage are available, these thresholds are the
first thing to revisit.
"""
from __future__ import annotations

import numpy as np

from app.models.schemas import KeyframeMetrics, KeyframeType

LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12
LEFT_HIP = 23
RIGHT_HIP = 24
LEFT_KNEE = 25
RIGHT_KNEE = 26
LEFT_ANKLE = 27
RIGHT_ANKLE = 28

# Thresholds for flagging a "concern" at a given keyframe. See module
# docstring — first-pass values, not yet validated against real footage.
KNEE_VALGUS_CONCERN_NORM = 0.12
TORSO_LEAN_CONCERN_DEG = 30.0
SHALLOW_ANTICIPATION_KNEE_FLEXION_DEG = 150.0  # too little knee bend at the deepest crouch
INCOMPLETE_TAKEOFF_KNEE_FLEXION_DEG = 165.0  # not extending the leg enough at takeoff
STIFF_ABSORPTION_KNEE_FLEXION_DEG = 150.0  # not enough knee bend absorbing the landing


def _angle_deg(a: np.ndarray, vertex: np.ndarray, c: np.ndarray) -> float | None:
    """Angle at `vertex`, in degrees, between rays to `a` and `c`."""
    ba = a - vertex
    bc = c - vertex
    denom = np.linalg.norm(ba) * np.linalg.norm(bc)
    if denom < 1e-9:
        return None
    cos_angle = np.clip(np.dot(ba, bc) / denom, -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_angle)))


def knee_flexion_deg(world_landmarks: np.ndarray | None) -> float | None:
    """Average of both knees' flexion angle (hip-knee-ankle), in degrees.
    180 = fully straight leg, smaller = more bent. None if landmarks are missing."""
    if world_landmarks is None:
        return None
    left = _angle_deg(world_landmarks[LEFT_HIP], world_landmarks[LEFT_KNEE], world_landmarks[LEFT_ANKLE])
    right = _angle_deg(world_landmarks[RIGHT_HIP], world_landmarks[RIGHT_KNEE], world_landmarks[RIGHT_ANKLE])
    angles = [a for a in (left, right) if a is not None]
    return float(np.mean(angles)) if angles else None


def knee_flexion_deg_2d_fallback(landmarks: np.ndarray | None) -> float | None:
    """Crude knee-angle estimate from 2D image-space landmarks (x, y only),
    used only when world_landmarks aren't available for a frame. Less
    accurate than the 3D version since it ignores depth entirely."""
    if landmarks is None:
        return None
    left = _angle_deg(landmarks[LEFT_HIP, :2], landmarks[LEFT_KNEE, :2], landmarks[LEFT_ANKLE, :2])
    right = _angle_deg(landmarks[RIGHT_HIP, :2], landmarks[RIGHT_KNEE, :2], landmarks[RIGHT_ANKLE, :2])
    angles = [a for a in (left, right) if a is not None]
    return float(np.mean(angles)) if angles else None


def knee_valgus_norm(world_landmarks: np.ndarray | None) -> float | None:
    """Average lateral (frontal-plane) deviation of the knees from the
    hip-ankle line, normalized to leg length. Positive = knees caving toward
    the midline (valgus); negative = bowing outward (varus).

    Sign convention here is a best-effort guess at MediaPipe's world-landmark
    axis orientation and has NOT been validated against real footage yet —
    treat the magnitude as more trustworthy than the sign until checked
    against a real video where the direction of any knee cave is known.
    """
    if world_landmarks is None:
        return None

    def _side(hip_idx: int, knee_idx: int, ankle_idx: int) -> float | None:
        hip, knee, ankle = world_landmarks[hip_idx], world_landmarks[knee_idx], world_landmarks[ankle_idx]
        vertical_span = ankle[1] - hip[1]
        if abs(vertical_span) < 1e-6:
            return None
        t = (knee[1] - hip[1]) / vertical_span
        expected_knee_x = hip[0] + t * (ankle[0] - hip[0])
        leg_length = float(np.linalg.norm(ankle - hip))
        if leg_length < 1e-6:
            return None
        return float((knee[0] - expected_knee_x) / leg_length)

    left = _side(LEFT_HIP, LEFT_KNEE, LEFT_ANKLE)
    right = _side(RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE)
    sides = [s for s in (left, right) if s is not None]
    return float(np.mean(sides)) if sides else None


def torso_lean_deg(world_landmarks: np.ndarray | None) -> float | None:
    """Torso angle from vertical, in degrees. 0 = perfectly upright."""
    if world_landmarks is None:
        return None
    hip_mid = (world_landmarks[LEFT_HIP] + world_landmarks[RIGHT_HIP]) / 2.0
    shoulder_mid = (world_landmarks[LEFT_SHOULDER] + world_landmarks[RIGHT_SHOULDER]) / 2.0
    torso_vec = shoulder_mid - hip_mid
    # World-landmark Y follows image convention (increases downward), so "up" is -Y.
    vertical = np.array([0.0, -1.0, 0.0])
    denom = np.linalg.norm(torso_vec)
    if denom < 1e-9:
        return None
    cos_angle = np.clip(float(np.dot(torso_vec, vertical)) / denom, -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_angle)))


def compute_keyframe_metrics(
    stage: KeyframeType,
    world_landmarks: np.ndarray | None,
) -> KeyframeMetrics:
    """Computes joint angles and applies fixed-threshold rules for a single keyframe."""
    knee_flexion = knee_flexion_deg(world_landmarks)
    valgus = knee_valgus_norm(world_landmarks)
    torso_lean = torso_lean_deg(world_landmarks)

    concerns: list[str] = []
    if valgus is not None and valgus > KNEE_VALGUS_CONCERN_NORM:
        concerns.append("knee_valgus")
    if torso_lean is not None and torso_lean > TORSO_LEAN_CONCERN_DEG:
        concerns.append("excessive_torso_lean")

    if stage == KeyframeType.MAX_ANTICIPATION and knee_flexion is not None:
        if knee_flexion > SHALLOW_ANTICIPATION_KNEE_FLEXION_DEG:
            concerns.append("shallow_counter_movement")
    elif stage == KeyframeType.TAKEOFF and knee_flexion is not None:
        if knee_flexion < INCOMPLETE_TAKEOFF_KNEE_FLEXION_DEG:
            concerns.append("incomplete_leg_extension")
    elif stage == KeyframeType.MAX_ABSORPTION and knee_flexion is not None:
        if knee_flexion > STIFF_ABSORPTION_KNEE_FLEXION_DEG:
            concerns.append("stiff_landing")

    return KeyframeMetrics(
        knee_flexion_deg=round(knee_flexion, 1) if knee_flexion is not None else None,
        knee_valgus_norm=round(valgus, 3) if valgus is not None else None,
        torso_lean_deg=round(torso_lean, 1) if torso_lean is not None else None,
        concerns=concerns,
    )
