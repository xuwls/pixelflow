from pathlib import Path

from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "dev-secret"

    DATABASE_URL: str = "postgresql+asyncpg://pixelflow:pixelflow_dev@localhost:5432/pixelflow"
    REDIS_URL: str = "redis://localhost:6379/0"

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "pixelflow-media"
    MINIO_SECURE: bool = False

    DASHSCOPE_API_KEY: str = ""

    MEDIA_WORK_DIR: str = "/app/media_work"

    FFMPEG_BIN: str = "ffmpeg"
    FFPROBE_BIN: str = "ffprobe"

    class Config:
        env_file = str(_ENV_FILE)


settings = Settings()
