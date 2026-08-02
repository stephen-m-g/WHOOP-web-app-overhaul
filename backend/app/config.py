"""Centralized application settings loaded from environment variables."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cors_origins: str = "http://localhost:3000"
    max_upload_mb: int = 500
    tmp_upload_dir: str = "tmp_uploads"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"

    # Optional Firestore/Cloud Storage persistence (app/services/storage.py).
    # Left unset, jump results stay ephemeral (analyzed and returned, nothing
    # saved) — exactly today's behavior. Both must be set to enable it.
    gcp_project_id: str = ""
    storage_bucket_name: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
