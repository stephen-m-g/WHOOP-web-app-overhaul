"""POST /analyze-jump — accepts a jump video + user height, returns jump
metrics, per-keyframe analysis, and coaching feedback."""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config import Settings, get_settings
from app.models.schemas import (
    JumpAnalysisResponse,
    JumpDetailResponse,
    JumpHistoryResponse,
    JumpRecordSummary,
    JumpType,
)
from app.services import pose_analyzer, storage, video_processor
from app.services.video_processor import VideoValidationError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/analyze-jump",
    response_model=JumpAnalysisResponse,
    responses={400: {"description": "Invalid input"}, 500: {"description": "Processing error"}},
)
async def analyze_jump(
    video: UploadFile = File(..., description="MP4 or MOV video of a vertical or broad jump"),
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

    ext = _validate_and_get_extension(video.filename)
    data = await video.read()
    _validate_size(data, settings.max_upload_bytes)

    saved_path = video_processor.save_upload(data, ext, settings.tmp_upload_dir)
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
