"""Shared test fixtures for pose_analyzer tests."""
import numpy as np
import pytest

from app.services.pose_analyzer import LEFT_ANKLE, LEFT_HIP, LEFT_KNEE, NOSE, RIGHT_ANKLE, RIGHT_HIP, RIGHT_KNEE


def make_landmarks(
    hip_y: float,
    ankle_y: float,
    nose_y: float = 0.15,
    knee_y: float | None = None,
    ankle_x: float = 0.5,
    visibility: float = 0.9,
) -> np.ndarray:
    """Builds a synthetic (33, 4) landmarks array with only the joints this
    codebase actually reads (nose/hip/knee/ankle) populated meaningfully;
    everything else is zeroed since it's unused by the analysis logic."""
    lm = np.zeros((33, 4), dtype=np.float32)
    lm[:, 3] = visibility
    if knee_y is None:
        knee_y = hip_y + (ankle_y - hip_y) * 0.5
    lm[NOSE, 1] = nose_y
    lm[LEFT_HIP, 1] = hip_y
    lm[RIGHT_HIP, 1] = hip_y
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
