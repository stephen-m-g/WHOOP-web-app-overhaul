"""Optional persistence for jump analysis results — Firestore for structured
records, Cloud Storage for keyframe still images (never full videos; those
are deleted right after processing regardless of this being enabled).

Feature-flagged via Settings and a no-op whenever GCP isn't configured, so
local development and the existing test suite work with zero GCP setup.

Setup (once a GCP project exists):
1. Enable the Firestore and Cloud Storage APIs on the project.
2. Create a Firestore database (Native mode) and a Cloud Storage bucket.
3. Set GCP_PROJECT_ID and STORAGE_BUCKET_NAME in the environment.
4. On Cloud Run, grant the service's runtime service account the
   `roles/datastore.user` and `roles/storage.objectAdmin` roles — no key
   file needed there, Application Default Credentials pick up the attached
   service account automatically. For local testing against a real
   project, run `gcloud auth application-default login` first.
5. `pip install google-cloud-firestore google-cloud-storage` (not in
   requirements.txt by default — see requirements.txt comment — since most
   local dev/testing never needs them).
"""
from __future__ import annotations

import base64
import logging
from datetime import datetime, timezone

from app.config import Settings, get_settings
from app.models.schemas import JumpAnalysisResponse, JumpType

logger = logging.getLogger(__name__)


def is_enabled(settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    return bool(settings.gcp_project_id and settings.storage_bucket_name)


def save_jump_record(
    user_id: str | None,
    jump_type: JumpType,
    result: JumpAnalysisResponse,
    settings: Settings | None = None,
) -> str | None:
    """Persists a jump's metrics + keyframe stills under the given user id.
    Returns the new record id, or None if storage isn't configured or no
    user_id was supplied — a deliberate no-op, never an error raised back
    to the caller, so a storage/config problem never blocks the user from
    seeing their analysis result."""
    settings = settings or get_settings()
    if not is_enabled(settings) or not user_id:
        return None

    try:
        from google.cloud import firestore, storage
    except ImportError:
        logger.warning("google-cloud-firestore/storage not installed — skipping persistence.")
        return None

    try:
        storage_client = storage.Client(project=settings.gcp_project_id)
        bucket = storage_client.bucket(settings.storage_bucket_name)
        db = firestore.Client(project=settings.gcp_project_id)

        doc_ref = db.collection("users").document(user_id).collection("jumps").document()
        record_id = doc_ref.id

        keyframe_docs = []
        for kf in result.keyframe_analyses:
            image_path = None
            if kf.image_b64:
                blob = bucket.blob(f"users/{user_id}/jumps/{record_id}/{kf.type.value}.jpg")
                blob.upload_from_string(base64.b64decode(kf.image_b64), content_type="image/jpeg")
                # Store the object path, not a public URL — the bucket should
                # stay private; sign a short-lived URL on read instead.
                image_path = blob.name
            keyframe_docs.append(
                {
                    "type": kf.type.value,
                    "frame": kf.frame,
                    "timestamp_ms": kf.timestamp_ms,
                    "metrics": kf.metrics.model_dump(),
                    "feedback": kf.feedback,
                    "image_path": image_path,
                }
            )

        doc_ref.set(
            {
                "created_at": datetime.now(timezone.utc),
                "jump_type": jump_type.value,
                "jump_height_cm": result.jump_height_cm,
                "jump_distance_cm": result.jump_distance_cm,
                "coaching_feedback": result.coaching_feedback,
                "analysis_confidence": result.analysis_confidence,
                "camera_warnings": [w.model_dump() for w in result.camera_warnings],
                "keyframes": keyframe_docs,
            }
        )
        return record_id
    except Exception:
        # Persistence failing must never fail the analysis request itself —
        # the user still gets their result even if it couldn't be saved.
        logger.exception("Failed to persist jump record — continuing without it.")
        return None


def list_jump_records(
    user_id: str,
    limit: int = 20,
    settings: Settings | None = None,
) -> list[dict]:
    """Returns the user's most recent jump records, newest first — summary
    fields only (not full keyframe detail; read the Firestore document
    directly for that). Returns an empty list if storage isn't configured,
    no user_id was supplied, or the query fails — never raises, matching
    save_jump_record's never-block-the-user philosophy."""
    settings = settings or get_settings()
    if not is_enabled(settings) or not user_id:
        return []

    try:
        from google.cloud import firestore
    except ImportError:
        logger.warning("google-cloud-firestore not installed — returning empty jump history.")
        return []

    try:
        db = firestore.Client(project=settings.gcp_project_id)
        query = (
            db.collection("users")
            .document(user_id)
            .collection("jumps")
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        return [
            {
                "id": doc.id,
                "created_at": data.get("created_at"),
                "jump_type": data.get("jump_type"),
                "jump_height_cm": data.get("jump_height_cm"),
                "jump_distance_cm": data.get("jump_distance_cm"),
                "analysis_confidence": data.get("analysis_confidence"),
            }
            for doc in query.stream()
            if (data := doc.to_dict()) is not None
        ]
    except Exception:
        logger.exception("Failed to fetch jump history — returning empty list.")
        return []


def get_jump_record(
    user_id: str,
    record_id: str,
    settings: Settings | None = None,
) -> dict | None:
    """Returns one full jump record — every keyframe image re-fetched from
    Cloud Storage and base64-encoded, matching the shape the analysis
    endpoint returns right after processing a video (see JumpAnalysisResponse).
    Returns None if storage isn't configured, no user_id was supplied, or the
    record doesn't exist — never raises, matching save_jump_record."""
    settings = settings or get_settings()
    if not is_enabled(settings) or not user_id:
        return None

    try:
        from google.cloud import firestore, storage
    except ImportError:
        logger.warning("google-cloud-firestore/storage not installed — cannot load jump detail.")
        return None

    try:
        db = firestore.Client(project=settings.gcp_project_id)
        doc_ref = db.collection("users").document(user_id).collection("jumps").document(record_id)
        snapshot = doc_ref.get()
        if not snapshot.exists:
            return None
        data = snapshot.to_dict() or {}

        storage_client = storage.Client(project=settings.gcp_project_id)
        bucket = storage_client.bucket(settings.storage_bucket_name)

        keyframe_analyses = []
        for kf in data.get("keyframes", []):
            image_b64 = None
            image_path = kf.get("image_path")
            if image_path:
                try:
                    image_b64 = base64.b64encode(bucket.blob(image_path).download_as_bytes()).decode("ascii")
                except Exception:
                    logger.exception("Failed to download keyframe image %s", image_path)
            keyframe_analyses.append(
                {
                    "type": kf.get("type"),
                    "frame": kf.get("frame"),
                    "timestamp_ms": kf.get("timestamp_ms"),
                    "image_b64": image_b64,
                    "metrics": kf.get("metrics") or {},
                    "feedback": kf.get("feedback") or "",
                }
            )

        return {
            "id": record_id,
            "created_at": data.get("created_at"),
            "jump_type": data.get("jump_type"),
            "result": {
                "jump_height_cm": data.get("jump_height_cm"),
                "jump_distance_cm": data.get("jump_distance_cm"),
                "keyframe_analyses": keyframe_analyses,
                "coaching_feedback": data.get("coaching_feedback") or "",
                "analysis_confidence": data.get("analysis_confidence") or 0.0,
                "processing_time_ms": 0,
                # Older records saved before camera_warnings persistence was
                # added won't have this field — default to empty.
                "camera_warnings": data.get("camera_warnings") or [],
            },
        }
    except Exception:
        logger.exception("Failed to load jump record %s for user %s — returning None.", record_id, user_id)
        return None
