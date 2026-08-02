FROM python:3.11-slim

# MediaPipe/OpenCV need these shared libs at runtime on a slim base image.
# curl is needed to fetch the PoseLandmarker model bundle below.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# --extra-index-url gives pip a prebuilt CPU wheel for llama-cpp-python;
# without it, pip falls back to a from-source CMake build that isn't
# reliable across environments (confirmed failing locally on Windows).
RUN pip install --no-cache-dir -r requirements.txt \
    --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu

COPY . .

# mediapipe>=1.0 ships without bundled model weights (Tasks API); fetch the
# pose landmarker bundle at build time so it's baked into the image.
RUN python scripts/download_model.py

# Optional: bake the ~2GB coaching LLM into the image too, so it's ready on
# the very first request instead of coaching_llm.py falling back to
# templated feedback until it's fetched. Uncomment once you've decided to
# use it — adds real build time/image size, and needs its own explicit
# go-ahead since it's a large download.
# RUN python scripts/download_coaching_model.py

ENV PORT=8080
EXPOSE 8080

# Cloud Run injects $PORT; uvicorn must bind to it directly (shell form for env expansion).
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
