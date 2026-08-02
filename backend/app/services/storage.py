"""Optional persistence for jump analysis results — Firestore for structured
records, Cloud Storage for keyframe still images (never full videos; those
are deleted right after processing regardless of this being enabled).

Feature-flagged via Settings and a no-op whenever GCP isn't configured, so
local development and the existing test suite work with zero GCP setup.

Also provides signed-URL video uploads (create_signed_upload_url /
download_temp_video / delete_temp_object) — used by /upload-url and
/analyze-jump so the browser can PUT large videos straight to Cloud Storage,
bypassing Cloud Run's hard 32MB request body limit. Unlike the result
persistence above, this is NOT optional in production: without it, videos
over ~32MB can never reach the backend at all. It's only skipped locally,
where the direct multipart upload on /analyze-jump is used instead since
Cloud Run's limit doesn't apply to a local uvicorn server.

Setup (once a GCP project exists):
1. Enable the Firestore and Cloud Storage APIs on the project.
2. Create a Firestore database (Native mode) and a Cloud Storage bucket.
3. Set GCP_PROJECT_ID and STORAGE_BUCKET_NAME in the environment.
4. On Cloud Run, grant the service's runtime service account the
   `roles/datastore.user` and `roles/storage.objectAdmin` roles — no key
   file needed there, Application Default Credentials pick up the attached
   service account automatically. For local testing against a real
   project, run `gcloud auth application-default login` first.
5. Also grant that same service account `roles/iam.serviceAccountTokenCreator`
   on ITSELF (a self-referential binding) — signed URLs are minted via the
   IAM signBlob API since Cloud Run's attached service account has no
   private key file, and signBlob needs that permission.
6. `pip install google-cloud-firestore google-cloud-storage` (not in
   requirements.txt by default — see requirements.txt comment — since most
   local dev/testing never needs them).
"""
from __future__ import annotations

import base64
import logging
import os
from datetime import datetime, timedelta, timezone

from app.config import Settings, get_settings
from app.models.schemas import JumpAnalysisResponse, JumpType

logger = logging.getLogger(__name__)

TEMP_UPLOAD_PREFIX = "tmp-uploads"


def is_enabled(settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    return bool(settings.gcp_project_id and settings.storage_bucket_name)


def create_signed_upload_url(object_path: str, content_type: str, settings: Settings | None = None) -> str:
    """Returns a short-lived (15 min) signed URL the browser can PUT a video
    directly to — the file never passes through this app for this step, so
    Cloud Run's 32MB request body limit never applies to it."""
    settings = settings or get_settings()
    import google.auth
    from google.auth.transport import requests as google_auth_requests
    from google.cloud import storage as gcs_storage

    client = gcs_storage.Client(project=settings.gcp_project_id)
    blob = client.bucket(settings.storage_bucket_name).blob(object_path)

    credentials, _ = google.auth.default()
    credentials.refresh(google_auth_requests.Request())

    if not hasattr(credentials, "service_account_email"):
        # google.auth.default() returns compute_engine.Credentials on Cloud
        # Run/GCE (has this attribute), but user OAuth credentials from
        # `gcloud auth application-default login` — the local-dev path this
        # module's docstring recommends — don't. Signing without a private
        # key needs a concrete service account to impersonate via IAM
        # signBlob, which user credentials don't carry.
        raise RuntimeError(
            "Signed upload URLs require Cloud Run's attached service account credentials "
            "(or another credential type exposing service_account_email); user ADC "
            "credentials can't sign URLs without impersonating a service account."
        )

    return blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=15),
        method="PUT",
        content_type=content_type,
        service_account_email=credentials.service_account_email,
        access_token=credentials.token,
    )


def download_temp_video(object_path: str, upload_dir: str, settings: Settings | None = None) -> str:
    """Downloads a browser-uploaded temp video to a local file for
    processing, returning the local path. Raises FileNotFoundError if the
    object doesn't exist (e.g. the signed URL expired unused)."""
    settings = settings or get_settings()
    from google.cloud import storage as gcs_storage

    client = gcs_storage.Client(project=settings.gcp_project_id)
    blob = client.bucket(settings.storage_bucket_name).blob(object_path)
    if not blob.exists():
        raise FileNotFoundError(f"Upload not found: {object_path}")

    os.makedirs(upload_dir, exist_ok=True)
    local_path = os.path.join(upload_dir, os.path.basename(object_path))
    blob.download_to_filename(local_path)
    return local_path


def delete_temp_object(object_path: str, settings: Settings | None = None) -> None:
    """Best-effort cleanup of a temp upload object after processing — never
    raises, matching this module's save_jump_record/-list/-get philosophy
    (a cleanup failure must never surface as a request error)."""
    settings = settings or get_settings()
    try:
        from google.cloud import storage as gcs_storage

        client = gcs_storage.Client(project=settings.gcp_project_id)
        client.bucket(settings.storage_bucket_name).blob(object_path).delete()
    except Exception:
        logger.warning("Failed to delete temp upload object %s", object_path, exc_info=True)


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
