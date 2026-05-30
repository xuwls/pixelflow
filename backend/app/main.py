import asyncio
import logging
import os
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import router as v1_router
from app.api.v1.ws import router as ws_router
from app.config import settings
from app.core.database import async_session_factory, engine
from app.services.ai.model_registry import reload_registry
from app.services.ai.seed import seed_if_empty
from app.services.storage import storage_service

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- pre-startup: run database migrations ---
    try:
        backend_dir = Path(__file__).resolve().parent.parent
        subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=backend_dir,
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        logger.info("Database migrations applied successfully")
    except Exception as exc:
        logger.warning("Alembic migration skipped or failed: %s", exc)

    # --- ensure working directory ---
    work_dir = os.environ.get("MEDIA_WORK_DIR", "/app/media_work")
    os.makedirs(work_dir, exist_ok=True)

    # --- ensure MinIO bucket (with retry, non-blocking) ---
    for attempt in range(1, 4):
        try:
            await storage_service.ensure_bucket()
            logger.info("MinIO bucket '%s' ready", settings.MINIO_BUCKET)
            break
        except Exception as exc:
            if attempt < 3:
                logger.warning(
                    "MinIO not ready (attempt %d/3): %s — retrying in 2s",
                    attempt, exc,
                )
                await asyncio.sleep(2)
            else:
                logger.error(
                    "MinIO bucket init failed after 3 attempts: %s. "
                    "File upload/download will not work until MinIO is reachable.",
                    exc,
                )

    # --- seed AI model registry ---
    try:
        async with async_session_factory() as session:
            seeded = await seed_if_empty(session)
            if seeded:
                logger.info("AI registry seeded with default catalog on first run")
            await reload_registry(session)
    except Exception as exc:
        logger.exception("AI registry init failed: %s", exc)

    yield

    # --- shutdown: dispose DB connections ---
    try:
        await engine.dispose()
        logger.info("Database connection pool disposed")
    except Exception:
        pass


app = FastAPI(
    title="PixelFlow",
    description="AI Product Video Generation Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# --- CORS ---
_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")
app.include_router(ws_router, prefix="/ws")


@app.get("/health")
async def health():
    result = {"status": "ok", "database": "ok", "redis": "ok", "minio": "ok"}

    # check database
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
    except Exception as exc:
        result["database"] = f"error: {exc}"
        result["status"] = "degraded"

    # check redis
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL)
        await r.ping()
        await r.aclose()
    except Exception as exc:
        result["redis"] = f"error: {exc}"
        result["status"] = "degraded"

    # check minio
    try:
        storage_service.client.head_bucket(Bucket=settings.MINIO_BUCKET)
    except Exception as exc:
        result["minio"] = f"error: {exc}"
        result["status"] = "degraded"

    return result
