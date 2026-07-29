"""OpenCV-backed helpers for loading, validating, and extracting frames from
uploaded jump videos."""
from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass

import cv2
import numpy as np

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".mp4", ".mov"}
MIN_DURATION_SECONDS = 1.0


class VideoValidationError(ValueError):
    """Raised when an uploaded video fails format/size/duration checks."""


@dataclass
class VideoInfo:
    path: str
    fps: float
    frame_count: int
    width: int
    height: int
    duration_seconds: float


def validate_extension(filename: str) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise VideoValidationError(
            f"Unsupported file format '{ext or 'unknown'}'. Allowed formats: "
            f"{', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )
    return ext


def save_upload(data: bytes, ext: str, upload_dir: str) -> str:
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(upload_dir, filename)
    with open(path, "wb") as f:
        f.write(data)
    return path


def probe_video(path: str) -> VideoInfo:
    """Open the video and read its basic metadata. Raises VideoValidationError
    if the file cannot be decoded or is too short."""
    cap = cv2.VideoCapture(path)
    try:
        if not cap.isOpened():
            raise VideoValidationError("Could not read video file. It may be corrupt or use an unsupported codec.")

        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

        if fps <= 0 or frame_count <= 0:
            raise VideoValidationError("Video has no readable frames.")

        duration_seconds = frame_count / fps
        if duration_seconds < MIN_DURATION_SECONDS:
            raise VideoValidationError(
                f"Video is too short ({duration_seconds:.2f}s). Minimum duration is "
                f"{MIN_DURATION_SECONDS:.0f}s."
            )

        return VideoInfo(
            path=path,
            fps=fps,
            frame_count=frame_count,
            width=width,
            height=height,
            duration_seconds=duration_seconds,
        )
    finally:
        cap.release()


def extract_frames(info: VideoInfo) -> list[np.ndarray]:
    """Decode every frame of the video into a list of BGR numpy arrays.

    Loads the whole clip into memory; fine for short jump clips (a few
    seconds) but not intended for long-form video.
    """
    cap = cv2.VideoCapture(info.path)
    frames: list[np.ndarray] = []
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frames.append(frame)
    finally:
        cap.release()

    if not frames:
        raise VideoValidationError("No frames could be decoded from the video.")
    return frames


def cleanup(path: str) -> None:
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except OSError:
        logger.warning("Failed to remove temp video file: %s", path, exc_info=True)
