"""Regression tests for app/services/biomechanics.py.

These verify the joint-angle MATH against known geometric cases (a straight
leg must read ~180 degrees, a 90-degree bend must read ~90, etc.) — this is
the part that's fully verifiable without a real jump video. The specific
concern *thresholds* (what counts as "elevated" valgus, etc.) are separately
flagged in the module docstring as needing real-footage validation; these
tests don't try to assert those are "correct" in an absolute sense, only
that the flagging logic fires/doesn't fire as configured.
"""
import numpy as np
import pytest

from app.models.schemas import KeyframeType
from app.services.biomechanics import (
    compute_keyframe_metrics,
    knee_flexion_deg,
    knee_flexion_deg_2d_fallback,
    knee_valgus_norm,
    torso_lean_deg,
)


class TestKneeFlexion:
    def test_straight_leg_is_180_degrees(self, world_landmarks_factory):
        # hip, knee, ankle colinear along the vertical axis.
        lm = world_landmarks_factory(hip_y=0.0, ankle_y=0.8)
        assert knee_flexion_deg(lm) == pytest.approx(180.0, abs=0.5)

    def test_90_degree_bend(self, world_landmarks_factory):
        # Thigh straight down (hip above knee, same x), shank straight
        # sideways (ankle at the same y as the knee, offset in x) — the
        # thigh and shank segments are perpendicular at the knee.
        lm = world_landmarks_factory(hip_y=0.0, hip_x=0.0, knee_y=0.4, knee_x=0.0, ankle_y=0.4, ankle_x=0.4)
        assert knee_flexion_deg(lm) == pytest.approx(90.0, abs=0.5)

    def test_none_when_no_world_landmarks(self):
        assert knee_flexion_deg(None) is None

    def test_2d_fallback_straight_leg(self, landmarks_factory):
        # hip/knee sit at x=0 in this fixture; ankle_x must match for a
        # genuinely straight (colinear) leg — the fixture's ankle_x default
        # of 0.5 would otherwise describe a bent leg.
        lm = landmarks_factory(hip_y=0.3, ankle_y=0.8, ankle_x=0.0)
        assert knee_flexion_deg_2d_fallback(lm) == pytest.approx(180.0, abs=0.5)


class TestKneeValgus:
    def test_straight_leg_is_neutral(self, world_landmarks_factory):
        lm = world_landmarks_factory(hip_y=0.0, ankle_y=0.8)
        assert knee_valgus_norm(lm) == pytest.approx(0.0, abs=1e-4)

    def test_knee_offset_from_hip_ankle_line_is_nonzero(self, world_landmarks_factory):
        # Knee shifted sideways relative to the straight hip-ankle line.
        lm = world_landmarks_factory(hip_y=0.0, ankle_y=0.8, hip_x=0.0, knee_x=0.1, ankle_x=0.0)
        valgus = knee_valgus_norm(lm)
        assert valgus is not None
        assert abs(valgus) > 0.05


class TestTorsoLean:
    def test_upright_torso_is_zero(self, world_landmarks_factory):
        lm = world_landmarks_factory(hip_y=0.0, ankle_y=0.8, shoulder_x=0.0)
        assert torso_lean_deg(lm) == pytest.approx(0.0, abs=0.5)

    def test_leaning_torso_is_nonzero(self, world_landmarks_factory):
        lm = world_landmarks_factory(hip_y=0.0, ankle_y=0.8, hip_x=0.0, shoulder_x=0.3, shoulder_y=-0.5)
        lean = torso_lean_deg(lm)
        assert lean is not None
        assert lean > 10.0


class TestComputeKeyframeMetrics:
    def test_no_world_landmarks_returns_empty_metrics(self):
        metrics = compute_keyframe_metrics(KeyframeType.PEAK, None)
        assert metrics.knee_flexion_deg is None
        assert metrics.concerns == []

    def test_shallow_anticipation_flagged(self, world_landmarks_factory):
        # Nearly straight leg at the deepest point of the counter-movement —
        # not much of a dip at all.
        lm = world_landmarks_factory(hip_y=0.0, ankle_y=0.8)
        metrics = compute_keyframe_metrics(KeyframeType.MAX_ANTICIPATION, lm)
        assert "shallow_counter_movement" in metrics.concerns

    def test_deep_anticipation_not_flagged(self, world_landmarks_factory):
        lm = world_landmarks_factory(hip_y=0.0, ankle_y=0.4, hip_x=0.0, knee_x=0.0, ankle_x=0.4)
        metrics = compute_keyframe_metrics(KeyframeType.MAX_ANTICIPATION, lm)
        assert "shallow_counter_movement" not in metrics.concerns

    def test_stiff_landing_flagged(self, world_landmarks_factory):
        lm = world_landmarks_factory(hip_y=0.0, ankle_y=0.8)
        metrics = compute_keyframe_metrics(KeyframeType.MAX_ABSORPTION, lm)
        assert "stiff_landing" in metrics.concerns
