"""Regression tests for app/services/pose_analyzer.py.

Two real bugs shipped and were only caught by manually eyeballing debug
output against a real jump video:
1. `_moving_average` zero-padded at array boundaries, fabricating a fake
   "peak" at the first/last frame of every clip (exactly where jump videos
   start/end standing).
2. `_compute_calibration` returned a scale in "normalized-units/cm" while
   being used as if it were "pixels/cm", producing heights off by roughly
   `frame_height_px`x (one video came back as 167,675.9 cm instead of ~37cm).

These tests exist so the next change to this math fails loudly in CI
instead of silently in someone's browser.
"""
import numpy as np
import pytest

from app.models.schemas import JumpType
from app.services.pose_analyzer import (
    FrameLandmarks,
    _compute_calibration,
    _find_largest_tracking_gap,
    _moving_average,
    analyze_jump,
)


class TestMovingAverage:
    def test_constant_series_stays_constant(self):
        # Regression test for the zero-padding artifact: a flat signal must
        # stay flat after smoothing. The original implementation produced a
        # fake dip at index 0 and the last index because np.convolve(...,
        # mode="same") implicitly zero-pads out-of-bounds samples.
        series = np.full(20, 0.7)
        smoothed = _moving_average(series, window=3)
        assert smoothed == pytest.approx(np.full(20, 0.7), abs=1e-6)

    def test_boundary_values_not_dragged_toward_zero(self):
        series = np.array([0.7, 0.7, 0.7, 0.5, 0.7, 0.7, 0.7])
        smoothed = _moving_average(series, window=3)
        # First and last smoothed values should reflect the actual edge data,
        # not be pulled toward 0 by an implicit zero-padded neighbor.
        assert smoothed[0] > 0.6
        assert smoothed[-1] > 0.6

    def test_short_series_returned_unchanged(self):
        series = np.array([0.1, 0.2])
        assert _moving_average(series, window=3) is series


class TestCalibration:
    def test_px_per_cm_is_in_pixel_units(self, landmarks_factory):
        # Regression test for the units bug: px_per_cm must scale with
        # frame_height_px. A calibration computed against a 3840px-tall frame
        # should be exactly 2x one computed against an otherwise-identical
        # 1920px-tall frame — if it doesn't, the pixel conversion got dropped
        # somewhere and callers dividing real pixel displacements by this
        # value will get wildly wrong results (as happened in production).
        frames = [FrameLandmarks(i, landmarks_factory(hip_y=0.5, ankle_y=0.88)) for i in range(10)]

        cal_1920 = _compute_calibration(frames, user_height_cm=177, frame_height_px=1920)
        cal_3840 = _compute_calibration(frames, user_height_cm=177, frame_height_px=3840)

        assert cal_3840.px_per_cm == pytest.approx(cal_1920.px_per_cm * 2, rel=1e-6)

    def test_matches_hand_calculated_scale(self, landmarks_factory):
        # Reproduces the exact numbers from a real bug report: hip_y=0.508,
        # ankle_y=0.882 (span=0.374), frame_height_px=3840, height=177cm.
        # Expected: (0.374 / 0.55) * 3840 / 177 ≈ 14.75 px/cm.
        frames = [FrameLandmarks(0, landmarks_factory(hip_y=0.508, ankle_y=0.882))]
        cal = _compute_calibration(frames, user_height_cm=177, frame_height_px=3840)
        assert cal.px_per_cm == pytest.approx(14.75, rel=0.01)

    def test_averages_across_multiple_frames(self, landmarks_factory):
        frames = [
            FrameLandmarks(0, landmarks_factory(hip_y=0.5, ankle_y=0.85)),
            FrameLandmarks(1, landmarks_factory(hip_y=0.5, ankle_y=0.87)),
            FrameLandmarks(2, landmarks_factory(hip_y=0.5, ankle_y=0.89)),
        ]
        cal = _compute_calibration(frames, user_height_cm=180, frame_height_px=1000)
        assert cal.frames_used == 3
        assert cal.avg_ankle_y == pytest.approx(0.87, abs=1e-6)

    def test_no_valid_frames_returns_zero(self):
        cal = _compute_calibration([FrameLandmarks(0, None)], user_height_cm=180, frame_height_px=1000)
        assert cal.px_per_cm == 0.0
        assert cal.frames_used == 0

    def test_zero_height_input_returns_zero_scale(self, landmarks_factory):
        frames = [FrameLandmarks(0, landmarks_factory(hip_y=0.5, ankle_y=0.88))]
        cal = _compute_calibration(frames, user_height_cm=0, frame_height_px=1000)
        assert cal.px_per_cm == 0.0


class TestTrackingGapDetection:
    def test_no_gap_when_fully_tracked(self, landmarks_factory):
        frames = [FrameLandmarks(i, landmarks_factory(0.5, 0.8)) for i in range(10)]
        assert _find_largest_tracking_gap(frames) is None

    def test_finds_gap_in_middle(self, landmarks_factory):
        frames = (
            [FrameLandmarks(i, landmarks_factory(0.5, 0.8)) for i in range(5)]
            + [FrameLandmarks(i, None) for i in range(5, 9)]
            + [FrameLandmarks(i, landmarks_factory(0.5, 0.8)) for i in range(9, 15)]
        )
        gap = _find_largest_tracking_gap(frames)
        assert gap is not None
        assert gap.start_frame == 5
        assert gap.end_frame == 8
        assert gap.length_frames == 4

    def test_picks_largest_of_multiple_gaps(self, landmarks_factory):
        frames = (
            [FrameLandmarks(0, landmarks_factory(0.5, 0.8))]
            + [FrameLandmarks(i, None) for i in range(1, 3)]  # gap of 2
            + [FrameLandmarks(3, landmarks_factory(0.5, 0.8))]
            + [FrameLandmarks(i, None) for i in range(4, 10)]  # gap of 6 (largest)
            + [FrameLandmarks(10, landmarks_factory(0.5, 0.8))]
        )
        gap = _find_largest_tracking_gap(frames)
        assert gap.length_frames == 6
        assert gap.start_frame == 4

    def test_gap_at_start_of_clip(self):
        frames = [FrameLandmarks(0, None), FrameLandmarks(1, None)]
        gap = _find_largest_tracking_gap(frames)
        assert gap.start_frame == 0
        assert gap.end_frame == 1

    def test_gap_at_end_of_clip(self, landmarks_factory):
        frames = [FrameLandmarks(0, landmarks_factory(0.5, 0.8)), FrameLandmarks(1, None)]
        gap = _find_largest_tracking_gap(frames)
        assert gap.start_frame == 1
        assert gap.end_frame == 1


class TestAnalyzeJumpEndToEnd:
    def _make_jump_sequence(self, landmarks_factory, standing_ankle_y=0.85, peak_ankle_y=0.65, n_standing=15, n_tail=15):
        """Builds a plausible full jump: stand -> crouch -> rise -> peak -> land -> stand."""
        frames = []
        idx = 0
        for _ in range(n_standing):
            frames.append(FrameLandmarks(idx, landmarks_factory(0.5, standing_ankle_y)))
            idx += 1
        # crouch (ankle moves down = higher y value = deeper knee bend)
        for ay in [standing_ankle_y + 0.02, standing_ankle_y + 0.03]:
            frames.append(FrameLandmarks(idx, landmarks_factory(0.55, ay)))
            idx += 1
        # rise to peak and back down
        rise = np.linspace(standing_ankle_y, peak_ankle_y, 5)
        fall = np.linspace(peak_ankle_y, standing_ankle_y, 5)
        for ay in list(rise) + list(fall)[1:]:
            frames.append(FrameLandmarks(idx, landmarks_factory(0.5, float(ay))))
            idx += 1
        for _ in range(n_tail):
            frames.append(FrameLandmarks(idx, landmarks_factory(0.5, standing_ankle_y)))
            idx += 1
        return frames

    def test_reasonable_jump_produces_sane_height(self, landmarks_factory):
        # This is the real-world sanity check the bugs above both broke:
        # a normal jump should come back in a normal range, not hundreds of
        # thousands of centimeters.
        frames = self._make_jump_sequence(landmarks_factory)
        metrics = analyze_jump(frames, fps=30.0, frame_height_px=1920, user_height_cm=177)
        assert metrics.jump_height_cm is not None
        assert 0 < metrics.jump_height_cm < 150  # generous upper bound; no human jumps 1000+cm

    def test_too_few_valid_frames_returns_no_detection(self):
        frames = [FrameLandmarks(i, None) for i in range(10)]
        metrics = analyze_jump(frames, fps=30.0, frame_height_px=1920, user_height_cm=177)
        assert metrics.jump_height_cm is None
        assert metrics.analysis_confidence == 0.0
        assert "couldn't reliably detect" in metrics.coaching_feedback

    def test_keyframes_are_ordered_by_frame(self, landmarks_factory):
        frames = self._make_jump_sequence(landmarks_factory)
        metrics = analyze_jump(frames, fps=30.0, frame_height_px=1920, user_height_cm=177)
        frame_numbers = [kf.frame for kf in metrics.keyframes]
        assert frame_numbers == sorted(frame_numbers)

    def test_missed_peak_detected_when_gap_overlaps_true_peak(self, landmarks_factory):
        # Reproduces the exact failure mode reported: body leaves frame at
        # the top of the jump, MediaPipe returns zero landmarks for those
        # frames, and the surviving frames closest to the gap should be
        # flagged as a probably-wrong peak.
        frames = [FrameLandmarks(i, landmarks_factory(0.5, 0.70)) for i in range(10)]
        frames += [FrameLandmarks(10, landmarks_factory(0.55, 0.72)), FrameLandmarks(11, landmarks_factory(0.55, 0.72))]
        frames += [FrameLandmarks(i, None) for i in range(12, 17)]  # true peak lost here
        frames += [
            FrameLandmarks(17, landmarks_factory(0.5, 0.55)),
            FrameLandmarks(18, landmarks_factory(0.5, 0.62)),
            FrameLandmarks(19, landmarks_factory(0.5, 0.68)),
        ]
        frames += [FrameLandmarks(i, landmarks_factory(0.5, 0.70)) for i in range(20, 28)]

        metrics = analyze_jump(frames, fps=30.0, frame_height_px=1920, user_height_cm=177, include_debug=True)
        assert metrics.debug.likely_missed_peak is True
        assert "tracking was lost" in metrics.coaching_feedback

    def test_no_gap_near_peak_does_not_flag_missed_peak(self, landmarks_factory):
        frames = self._make_jump_sequence(landmarks_factory)
        metrics = analyze_jump(frames, fps=30.0, frame_height_px=1920, user_height_cm=177, include_debug=True)
        assert metrics.debug.likely_missed_peak is False

    def test_low_headroom_warns_without_gap(self, landmarks_factory):
        # nose_y close to 0 (top of frame) even without any tracking gap.
        frames = [
            FrameLandmarks(i, landmarks_factory(hip_y=0.5, ankle_y=0.85, nose_y=0.05))
            for i in range(20)
        ]
        metrics = analyze_jump(frames, fps=30.0, frame_height_px=1920, user_height_cm=177, include_debug=True)
        assert "not much space above your head" in metrics.coaching_feedback


class TestBroadJumpDistance:
    def test_vertical_jump_type_never_computes_distance(self, landmarks_factory):
        # Default/vertical jump_type should leave jump_distance_cm as None
        # even if there happens to be horizontal ankle movement in the clip.
        frames = [FrameLandmarks(i, landmarks_factory(0.5, 0.85, ankle_x=0.3 + i * 0.01)) for i in range(20)]
        metrics = analyze_jump(
            frames, fps=30.0, frame_height_px=1920, frame_width_px=1080, user_height_cm=177,
            jump_type=JumpType.VERTICAL,
        )
        assert metrics.jump_distance_cm is None

    def test_broad_jump_measures_horizontal_ankle_displacement(self, landmarks_factory):
        # Standing at x=0.3, landing at x=0.5 (moved forward 0.2 of frame width).
        standing_x, landing_x = 0.3, 0.5
        frame_width_px = 1080

        frames = [FrameLandmarks(i, landmarks_factory(0.5, 0.85, ankle_x=standing_x)) for i in range(10)]
        # vertical arc so keyframe detection still finds a peak/landing
        rise = np.linspace(0.85, 0.65, 5)
        fall = np.linspace(0.65, 0.85, 5)
        idx = 10
        for ay in list(rise) + list(fall)[1:]:
            # interpolate x from standing to landing across the airborne frames
            t = (idx - 10) / 8
            x = standing_x + (landing_x - standing_x) * t
            frames.append(FrameLandmarks(idx, landmarks_factory(0.5, float(ay), ankle_x=x)))
            idx += 1
        frames += [FrameLandmarks(i, landmarks_factory(0.5, 0.85, ankle_x=landing_x)) for i in range(idx, idx + 10)]

        metrics = analyze_jump(
            frames, fps=30.0, frame_height_px=1920, frame_width_px=frame_width_px, user_height_cm=177,
            jump_type=JumpType.BROAD, include_debug=True,
        )
        assert metrics.jump_distance_cm is not None
        assert metrics.jump_distance_cm > 0
        assert "Estimated jump distance" in metrics.coaching_feedback
        assert metrics.debug.horizontal_displacement_norm is not None
        assert metrics.debug.horizontal_displacement_norm == pytest.approx(0.2, abs=0.05)

    def test_broad_jump_without_frame_width_skips_distance(self, landmarks_factory):
        frames = [FrameLandmarks(i, landmarks_factory(0.5, 0.85)) for i in range(20)]
        metrics = analyze_jump(
            frames, fps=30.0, frame_height_px=1920, frame_width_px=0, user_height_cm=177,
            jump_type=JumpType.BROAD,
        )
        assert metrics.jump_distance_cm is None
