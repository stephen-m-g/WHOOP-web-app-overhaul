"""Tests for the templated-fallback path in app/services/coaching_llm.py.

The `no_real_llm` autouse fixture (conftest.py) forces `_get_llm()` to
return None for the whole suite, so these tests exercise the fallback
deterministically regardless of whether the ~2GB GGUF model (see
scripts/download_coaching_model.py) happens to be present on this machine.
The real LLM path isn't covered by automated tests — it's manually
verified after downloading the model.
"""
from app.models.schemas import KeyframeMetrics, KeyframeType
from app.services.coaching_llm import generate_stage_feedback


def test_falls_back_without_model_file():
    metrics = KeyframeMetrics(knee_flexion_deg=178.0, knee_valgus_norm=0.2, concerns=["knee_valgus"])
    feedback = generate_stage_feedback(KeyframeType.TAKEOFF, metrics)
    assert isinstance(feedback, str)
    assert len(feedback) > 0
    assert "caving inward" in feedback


def test_no_concerns_gives_encouragement():
    metrics = KeyframeMetrics(knee_flexion_deg=90.0, concerns=[])
    feedback = generate_stage_feedback(KeyframeType.MAX_ANTICIPATION, metrics)
    assert "Looks good" in feedback


def test_multiple_concerns_all_mentioned():
    metrics = KeyframeMetrics(concerns=["knee_valgus", "excessive_torso_lean"])
    feedback = generate_stage_feedback(KeyframeType.PEAK, metrics)
    assert "caving inward" in feedback
    assert "leaning further" in feedback
