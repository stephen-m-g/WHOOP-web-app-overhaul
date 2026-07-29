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
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# mediapipe>=1.0 ships without bundled model weights (Tasks API); fetch the
# pose landmarker bundle at build time so it's baked into the image.
RUN python scripts/download_model.py

ENV PORT=8080
EXPOSE 8080

# Cloud Run injects $PORT; uvicorn must bind to it directly (shell form for env expansion).
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
