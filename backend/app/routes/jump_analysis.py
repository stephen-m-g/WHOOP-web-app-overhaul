"""POST /analyze-jump — accepts a jump video + user height, returns jump
metrics, per-keyframe analysis, and coaching feedback."""
from __future__ import annotations

import logging
import time
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config import Settings, get_settings
from app.models.schemas import (
    JumpAnalysisResponse,
    JumpDetailResponse,
    JumpHistoryResponse,
    JumpRecordSummary,
    JumpType,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.services import pose_analyzer, storage, video_processor
from app.services.video_processor import VideoValidationError

logger = logging.getLogger(__name__)

router = APIRouter()

_CONTENT_TYPE_EXTENSIONS = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
}


@router.post("/upload-url", response_model=UploadUrlResponse)
async def create_upload_url(
    body: UploadUrlRequest,
    settings: Settings = Depends(get_settings),
) -> UploadUrlResponse:
    """Mints a signed URL the browser can PUT a video directly to in Cloud
    Storage. Used instead of a plain multipart upload to /analyze-jump in
    production, since Cloud Run enforces a hard 32MB request body limit that
    an app-level setting can't raise."""
    if not storage.is_enabled(settings):
        raise HTTPException(
            status_code=503,
            detail="Direct video upload isn't configured on this deployment "
            "(GCP_PROJECT_ID/STORAGE_BUCKET_NAME unset).",
        )
    ext = _CONTENT_TYPE_EXTENSIONS.get(body.content_type.lower())
    if ext is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content type '{body.content_type}'. "
            f"Allowed: {', '.join(_CONTENT_TYPE_EXTENSIONS)}",
        )
    object_path = f"{storage.TEMP_UPLOAD_PREFIX}/{uuid.uuid4().hex}{ext}"
    upload_url = storage.create_signed_upload_url(object_path, body.content_type, settings)
    return UploadUrlResponse(upload_url=upload_url, object_path=object_path)


@router.post(
    "/analyze-jump",
    response_model=JumpAnalysisResponse,
    responses={400: {"description": "Invalid input"}, 500: {"description": "Processing error"}},
)
async def analyze_jump(
    video: UploadFile | None = File(
        None, description="MP4 or MOV video, for local dev direct upload. Omit if using video_gcs_path."
    ),
    video_gcs_path: str | None = Form(
        None,
        description="Object path returned by POST /upload-url, for videos uploaded directly to Cloud Storage. "
        "Used in production instead of `video` since Cloud Run caps request bodies at 32MB.",
    ),
    user_height_cm: float = Form(..., gt=0, description="User's height in centimeters, used for calibration"),
    jump_type: JumpType = Form(
        JumpType.VERTICAL,
        description="'vertical' (default) or 'broad'. Broad jump distance assumes a side-on camera angle.",
    ),
    user_id: str | None = Form(
        None, description="Whoop user id, used only to scope saved jump history. Omit to skip persistence."
    ),
    include_debug: bool = Form(
        False, description="If true, include intermediate calibration/comparison values (not needed for normal use)"
    ),
    settings: Settings = Depends(get_settings),
) -> JumpAnalysisResponse:
    start = time.perf_counter()

    if video is not None:
        ext = _validate_and_get_extension(video.filename)
        data = await video.read()
        _validate_size(data, settings.max_upload_bytes)
        saved_path = video_processor.save_upload(data, ext, settings.tmp_upload_dir)
    elif video_gcs_path:
        _validate_and_get_extension(video_gcs_path)
        try:
            saved_path = storage.download_temp_video(video_gcs_path, settings.tmp_upload_dir, settings)
        except FileNotFoundError as exc:
            raise HTTPException(
                status_code=400, detail="Uploaded video not found or expired. Please try again."
            ) from exc
    else:
        raise HTTPException(status_code=400, detail="Provide either a video file or video_gcs_path.")

    try:
        info = video_processor.probe_video(saved_path)
        frames = video_processor.extract_frames(info)
        landmarks = pose_analyzer.run_pose_estimation(frames, fps=info.fps)
        metrics = pose_analyzer.analyze_jump(
            landmarks,
            fps=info.fps,
            frame_height_px=info.height,
            user_height_cm=user_height_cm,
            frame_width_px=info.width,
            jump_type=jump_type,
            # Always pass frames now — every keyframe gets an annotated still
            # as a core part of the response, not just an opt-in debug extra.
            frames=frames,
            include_debug=include_debug,
        )
    except VideoValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - convert any processing failure to a clean 500
        logger.exception("Unexpected error while analyzing jump video")
        raise HTTPException(status_code=500, detail="Failed to process video. Please try again.") from exc
    finally:
        video_processor.cleanup(saved_path)
        if video_gcs_path:
            storage.delete_temp_object(video_gcs_path, settings)

    processing_time_ms = int((time.perf_counter() - start) * 1000)

    response = JumpAnalysisResponse(
        jump_height_cm=metrics.jump_height_cm,
        jump_distance_cm=metrics.jump_distance_cm,
        keyframe_analyses=metrics.keyframe_analyses,
        coaching_feedback=metrics.coaching_feedback,
        analysis_confidence=metrics.analysis_confidence,
        processing_time_ms=processing_time_ms,
        camera_warnings=metrics.camera_warnings,
        debug=metrics.debug,
    )

    # Best-effort; storage.save_jump_record() never raises, and is a no-op
    # unless both GCP settings and a user_id are present.
    storage.save_jump_record(user_id, jump_type, response, settings)

    return response


@router.get("/jumps", response_model=JumpHistoryResponse)
async def get_jump_history(
    user_id: str,
    limit: int = 20,
    settings: Settings = Depends(get_settings),
) -> JumpHistoryResponse:
    """Returns a user's most recent saved jump records (summary fields only).
    Empty if storage isn't configured, matching how persistence silently
    no-ops on save when it's unavailable."""
    records = storage.list_jump_records(user_id, limit, settings)
    return JumpHistoryResponse(jumps=[JumpRecordSummary(**record) for record in records])


@router.get(
    "/jumps/{record_id}",
    response_model=JumpDetailResponse,
    responses={404: {"description": "Jump record not found"}},
)
async def get_jump_detail(
    record_id: str,
    user_id: str,
    settings: Settings = Depends(get_settings),
) -> JumpDetailResponse:
    """Returns one full saved jump — every keyframe image re-fetched from
    Cloud Storage, matching what the analysis endpoint returned right after
    processing."""
    record = storage.get_jump_record(user_id, record_id, settings)
    if record is None:
        raise HTTPException(status_code=404, detail="Jump record not found.")
    return JumpDetailResponse(**record)


def _validate_and_get_extension(filename: str | None) -> str:
    try:
        return video_processor.validate_extension(filename or "")
    except VideoValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _validate_size(data: bytes, max_bytes: int) -> None:
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded video is empty.")
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Video exceeds max upload size of {max_bytes // (1024 * 1024)}MB.",
        )
