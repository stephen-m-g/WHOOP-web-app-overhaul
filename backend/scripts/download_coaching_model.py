"""Downloads the GGUF weights for the coaching feedback LLM (app/services/coaching_llm.py).

Not run automatically by anything (unlike scripts/download_model.py, which
the Dockerfile invokes at build time) — this is a deliberate, separate step
since the file is a ~2GB download. Until it's run, coaching_llm.py falls
back to plain templated feedback, so the rest of the pipeline works without it.

Model: Llama 3.2 3B Instruct, Q4_K_M quantization (bartowski/Llama-3.2-3B-Instruct-GGUF
on Hugging Face) — a small, free-to-self-host, open-weight instruct model. Only used
here to turn pre-computed biomechanical facts into natural sentences, never to judge
form on its own, so a 3B model is more than capable of the task.
"""
from __future__ import annotations

import os
import urllib.request

MODEL_URL = (
    "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/"
    "resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf"
)

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST_PATH = os.path.join(BACKEND_DIR, "models", "coaching_llm.gguf")


def _report_progress(block_num: int, block_size: int, total_size: int) -> None:
    if total_size <= 0:
        return
    downloaded = block_num * block_size
    percent = min(100.0, downloaded / total_size * 100)
    print(f"\r  {percent:5.1f}% ({downloaded / 1e6:.0f} MB / {total_size / 1e6:.0f} MB)", end="", flush=True)


def main() -> None:
    os.makedirs(os.path.dirname(DEST_PATH), exist_ok=True)
    if os.path.exists(DEST_PATH):
        print(f"Model already present at {DEST_PATH}")
        return

    print(f"Downloading coaching LLM (~2GB) to {DEST_PATH} ...")
    urllib.request.urlretrieve(MODEL_URL, DEST_PATH, reporthook=_report_progress)
    print("\nDone.")


if __name__ == "__main__":
    main()
