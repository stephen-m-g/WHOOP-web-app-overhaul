"""POST /analyze-jump — accepts a jump video + user height, returns jump
metrics, keyframes, and coaching feedback."""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config import Settings, get_settings
from app.models.schemas import JumpAnalysisResponse
from app.services import pose_analyzer, video_processor
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
        )
    except VideoValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - convert any processing failure to a clean 500
        logger.exception("Unexpected error while analyzing jump video")
        raise HTTPException(status_code=500, detail="Failed to process video. Please try again.") from exc
    finally:
        video_processor.cleanup(saved_path)

    processing_time_ms = int((time.perf_counter() - start) * 1000)

    return JumpAnalysisResponse(
        jump_height_cm=metrics.jump_height_cm,
        jump_distance_cm=metrics.jump_distance_cm,
        keyframes=metrics.keyframes,
        coaching_feedback=metrics.coaching_feedback,
        analysis_confidence=metrics.analysis_confidence,
        processing_time_ms=processing_time_ms,
    )


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
