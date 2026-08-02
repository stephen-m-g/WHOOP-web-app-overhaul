"""Shared test fixtures for pose_analyzer/biomechanics tests."""
import numpy as np
import pytest

from app.services import coaching_llm
from app.services.pose_analyzer import (
    LEFT_ANKLE,
    LEFT_HIP,
    LEFT_KNEE,
    LEFT_SHOULDER,
    NOSE,
    RIGHT_ANKLE,
    RIGHT_HIP,
    RIGHT_KNEE,
    RIGHT_SHOULDER,
)


def make_landmarks(
    hip_y: float,
    ankle_y: float,
    nose_y: float = 0.15,
    knee_y: float | None = None,
    ankle_x: float = 0.5,
    hip_x: float = 0.0,
    shoulder_y: float | None = None,
    visibility: float = 0.9,
) -> np.ndarray:
    """Builds a synthetic (33, 4) landmarks array with only the joints this
    codebase actually reads (nose/hip/knee/ankle/shoulder) populated
    meaningfully; everything else is zeroed since it's unused by the
    analysis logic."""
    lm = np.zeros((33, 4), dtype=np.float32)
    lm[:, 3] = visibility
    if knee_y is None:
        knee_y = hip_y + (ankle_y - hip_y) * 0.5
    if shoulder_y is None:
        # Realistic default: shoulders sit above the hips by roughly 1/1.7th
        # of the hip-to-ankle span — matches the anthropometric ratio
        # pose_analyzer.py's camera-pitch check expects, so tests that don't
        # care about torso proportions still look like a real standing
        # person instead of a degenerate (0, 0) shoulder position.
        shoulder_y = hip_y - abs(ankle_y - hip_y) / 1.7
    lm[NOSE, 1] = nose_y
    lm[LEFT_SHOULDER, 1] = shoulder_y
    lm[RIGHT_SHOULDER, 1] = shoulder_y
    lm[LEFT_HIP, 1] = hip_y
    lm[RIGHT_HIP, 1] = hip_y
    lm[LEFT_HIP, 0] = hip_x
    lm[RIGHT_HIP, 0] = hip_x
    lm[LEFT_KNEE, 1] = knee_y
    lm[RIGHT_KNEE, 1] = knee_y
    lm[LEFT_ANKLE, 1] = ankle_y
    lm[RIGHT_ANKLE, 1] = ankle_y
    lm[LEFT_ANKLE, 0] = ankle_x
    lm[RIGHT_ANKLE, 0] = ankle_x
    return lm


@pytest.fixture
def landmarks_factory():
    return make_landmarks


def make_world_landmarks(
    hip_y: float,
    ankle_y: float,
    hip_x: float = 0.0,
    knee_x: float | None = None,
    knee_y: float | None = None,
    ankle_x: float = 0.0,
    shoulder_x: float | None = None,
    shoulder_y: float | None = None,
) -> np.ndarray:
    """Builds a synthetic (33, 3) world-landmark array (meters, hip-centered,
    Y increases downward matching image convention) with a symmetric
    left/right stance — only the joints biomechanics.py reads are populated."""
    lm = np.zeros((33, 3), dtype=np.float32)
    if knee_y is None:
        knee_y = hip_y + (ankle_y - hip_y) * 0.5  # midpoint by default
    if knee_x is None:
        knee_x = hip_x + (ankle_x - hip_x) * 0.5  # straight leg by default
    if shoulder_y is None:
        shoulder_y = hip_y - 0.5  # shoulders above hips
    if shoulder_x is None:
        shoulder_x = hip_x  # upright torso by default

    for hip_idx, knee_idx, ankle_idx in [(LEFT_HIP, LEFT_KNEE, LEFT_ANKLE), (RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE)]:
        lm[hip_idx] = [hip_x, hip_y, 0.0]
        lm[knee_idx] = [knee_x, knee_y, 0.0]
        lm[ankle_idx] = [ankle_x, ankle_y, 0.0]
    lm[LEFT_SHOULDER] = [shoulder_x, shoulder_y, 0.0]
    lm[RIGHT_SHOULDER] = [shoulder_x, shoulder_y, 0.0]
    return lm


@pytest.fixture
def world_landmarks_factory():
    return make_world_landmarks


@pytest.fixture(autouse=True)
def no_real_llm(monkeypatch):
    """Forces the templated-fallback path in coaching_llm.py for every test.

    Whether the ~2GB GGUF model happens to be downloaded on the machine
    running the suite is incidental — tests must stay fast and deterministic
    either way, and none of them are actually testing real LLM output.
    """
    monkeypatch.setattr(coaching_llm, "_get_llm", lambda: None)
