"""Tests for the no-op guards in app/services/storage.py.

The actual Firestore/Cloud Storage calls need live GCP credentials, so
they aren't exercised here — what's fully testable without them is that
persistence and history-reading degrade gracefully (return None/[] rather
than raising) whenever storage isn't configured or no user_id is given,
exactly like this test environment.
"""
from app.config import Settings
from app.models.schemas import JumpAnalysisResponse, JumpType
from app.services.storage import get_jump_record, is_enabled, list_jump_records, save_jump_record

DISABLED_SETTINGS = Settings(gcp_project_id="", storage_bucket_name="")
ENABLED_SETTINGS = Settings(gcp_project_id="test-project", storage_bucket_name="test-bucket")


def _fake_response() -> JumpAnalysisResponse:
    return JumpAnalysisResponse(
        jump_height_cm=42.0,
        jump_distance_cm=None,
        keyframe_analyses=[],
        coaching_feedback="Nice jump.",
        analysis_confidence=0.9,
        processing_time_ms=100,
    )


def test_is_enabled_requires_both_settings():
    assert is_enabled(DISABLED_SETTINGS) is False
    assert is_enabled(Settings(gcp_project_id="p", storage_bucket_name="")) is False
    assert is_enabled(Settings(gcp_project_id="", storage_bucket_name="b")) is False
    assert is_enabled(ENABLED_SETTINGS) is True


def test_save_jump_record_noop_when_disabled():
    assert save_jump_record("user123", JumpType.VERTICAL, _fake_response(), DISABLED_SETTINGS) is None


def test_save_jump_record_noop_without_user_id():
    assert save_jump_record(None, JumpType.VERTICAL, _fake_response(), ENABLED_SETTINGS) is None
    assert save_jump_record("", JumpType.VERTICAL, _fake_response(), ENABLED_SETTINGS) is None


def test_list_jump_records_empty_when_disabled():
    assert list_jump_records("user123", settings=DISABLED_SETTINGS) == []


def test_list_jump_records_empty_without_user_id():
    assert list_jump_records("", settings=ENABLED_SETTINGS) == []


def test_get_jump_record_none_when_disabled():
    assert get_jump_record("user123", "record456", DISABLED_SETTINGS) is None


def test_get_jump_record_none_without_user_id():
    assert get_jump_record("", "record456", ENABLED_SETTINGS) is None
