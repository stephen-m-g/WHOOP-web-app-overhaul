"""Downloads the MediaPipe PoseLandmarker model bundle used by pose_analyzer.

The Tasks API (mediapipe>=1.0) no longer bundles model weights in the pip
package, so this needs to be fetched once — locally, and again during the
Docker build (see Dockerfile).
"""
from __future__ import annotations

import os
import urllib.request

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
)

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST_PATH = os.path.join(BACKEND_DIR, "models", "pose_landmarker_lite.task")


def main() -> None:
    os.makedirs(os.path.dirname(DEST_PATH), exist_ok=True)
    if os.path.exists(DEST_PATH):
        print(f"Model already present at {DEST_PATH}")
        return

    print(f"Downloading pose landmarker model to {DEST_PATH} ...")
    urllib.request.urlretrieve(MODEL_URL, DEST_PATH)
    print("Done.")


if __name__ == "__main__":
    main()
