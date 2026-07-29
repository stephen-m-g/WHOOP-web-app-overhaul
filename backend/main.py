"""FastAPI entrypoint for the Whoop Jump Training backend."""
import logging

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routes.jump_analysis import router as jump_analysis_router

settings = get_settings()

logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger("whoop.backend")

app = FastAPI(
    title="Whoop Jump Training API",
    description="Computer-vision jump analysis service (MediaPipe Pose + OpenCV).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jump_analysis_router, tags=["jump-analysis"])


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
