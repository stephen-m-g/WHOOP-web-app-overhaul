"""Turns structured biomechanical facts (see biomechanics.py) into natural
coaching prose using a small, locally-hosted open-weight LLM.

The LLM never sees the video or judges form itself — it only paraphrases
facts and concern flags that biomechanics.py already computed from tracked
landmarks. That keeps the actual analysis deterministic and testable, while
still getting more natural, varied coaching language than a fixed template.

Falls back to a plain templated sentence when the model file isn't present
(e.g. before `python scripts/download_coaching_model.py` has been run) or
`llama-cpp-python` isn't installed, so the rest of the pipeline works
without it — this module is additive, not a hard dependency of analysis.
"""
from __future__ import annotations

import logging
import os
import threading

from app.models.schemas import KeyframeMetrics, KeyframeType

logger = logging.getLogger(__name__)

MODEL_PATH = os.environ.get(
    "COACHING_MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "..", "..", "models", "coaching_llm.gguf"),
)

SYSTEM_PROMPT = (
    "You are a concise jump-training coach. Given measured facts about one frame of an "
    "athlete's jump, write ONE short sentence of coaching feedback. Be specific and "
    "actionable if an issue is flagged; if none are flagged, give brief encouragement. "
    "Never invent facts beyond what's given, and never mention raw numbers or degrees — "
    "translate them into plain coaching language."
)

STAGE_DESCRIPTIONS: dict[KeyframeType, str] = {
    KeyframeType.INITIATION: "the upright standing position right before the jump begins",
    KeyframeType.MAX_ANTICIPATION: "the lowest point of the counter-movement dip, right before driving upward",
    KeyframeType.TAKEOFF: "the last instant the feet are still in contact with the ground",
    KeyframeType.PEAK: "the highest point of the jump",
    KeyframeType.TOUCHDOWN: "the first instant the feet make contact with the ground again",
    KeyframeType.MAX_ABSORPTION: "the point of deepest knee bend while absorbing the landing",
}

# Also used by the templated fallback when the LLM isn't available.
CONCERN_DESCRIPTIONS: dict[str, str] = {
    "knee_valgus": "the knees are caving inward toward the midline",
    "excessive_torso_lean": "the torso is leaning further than ideal",
    "shallow_counter_movement": "the counter-movement dip looks shallow, which limits how much power can be generated",
    "incomplete_leg_extension": "the legs aren't fully extending at takeoff",
    "stiff_landing": "the knees aren't bending much to absorb the landing, which increases impact stress",
}

_lock = threading.Lock()
_llm = None
_load_attempted = False


def _get_llm():
    """Lazily loads the GGUF model once per process (not per-request) so a
    warm container only pays the load cost once. Returns None — never
    raises — if the model file is missing or the load fails, so callers
    always have a safe fallback path."""
    global _llm, _load_attempted
    if _llm is not None or _load_attempted:
        return _llm

    with _lock:
        if _llm is not None or _load_attempted:
            return _llm
        _load_attempted = True

        if not os.path.exists(MODEL_PATH):
            logger.warning(
                "Coaching LLM model not found at %s — using templated feedback instead. Run "
                "`python scripts/download_coaching_model.py` to enable natural-language feedback.",
                MODEL_PATH,
            )
            return None

        try:
            from llama_cpp import Llama
        except ImportError:
            logger.warning("llama-cpp-python not installed — using templated feedback instead.")
            return None

        try:
            _llm = Llama(model_path=MODEL_PATH, n_ctx=512, n_threads=os.cpu_count() or 4, verbose=False)
        except Exception:
            logger.exception("Failed to load coaching LLM — using templated feedback instead.")
            _llm = None

        return _llm


def _build_user_message(stage: KeyframeType, metrics: KeyframeMetrics) -> str:
    facts = []
    if metrics.knee_flexion_deg is not None:
        facts.append(f"knee flexion angle: {metrics.knee_flexion_deg:.0f} degrees (180 = straight leg)")
    if metrics.knee_valgus_norm is not None:
        facts.append(f"knee lateral deviation: {metrics.knee_valgus_norm:.2f} (0 = neutral)")
    if metrics.torso_lean_deg is not None:
        facts.append(f"torso lean from vertical: {metrics.torso_lean_deg:.0f} degrees")
    facts_block = "; ".join(facts) if facts else "no measurements available"

    concern_lines = [CONCERN_DESCRIPTIONS.get(c, c) for c in metrics.concerns]
    concerns_block = "; ".join(concern_lines) if concern_lines else "no issues flagged"

    return (
        f"Stage: {stage.value} ({STAGE_DESCRIPTIONS[stage]}).\n"
        f"Measurements: {facts_block}.\n"
        f"Flagged issues: {concerns_block}."
    )


def _fallback_feedback(metrics: KeyframeMetrics) -> str:
    if not metrics.concerns:
        return "Looks good at this stage — no issues flagged."
    descriptions = [CONCERN_DESCRIPTIONS.get(c, c) for c in metrics.concerns]
    return "Worth a look: " + "; ".join(descriptions) + "."


def generate_stage_feedback(stage: KeyframeType, metrics: KeyframeMetrics) -> str:
    """Returns one short sentence of coaching feedback for this keyframe.
    Uses the local LLM if available, otherwise a plain templated fallback
    built from the same concern flags."""
    llm = _get_llm()
    if llm is None:
        return _fallback_feedback(metrics)

    try:
        response = llm.create_chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_message(stage, metrics)},
            ],
            max_tokens=80,
            temperature=0.4,
        )
        text = response["choices"][0]["message"]["content"].strip()
        return text if text else _fallback_feedback(metrics)
    except Exception:
        logger.exception("Coaching LLM generation failed — using templated feedback instead.")
        return _fallback_feedback(metrics)
