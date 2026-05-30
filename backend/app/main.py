import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as v1_router
from app.api.v1.ws import router as ws_router
from app.core.database import async_session_factory
from app.services.ai.model_registry import reload_registry
from app.services.ai.seed import seed_if_empty
from app.services.storage import storage_service

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("/app/media_work", exist_ok=True)
    await storage_service.ensure_bucket()

    async with async_session_factory() as session:
        try:
            seeded = await seed_if_empty(session)
            if seeded:
                logger.info("AI registry seeded with default catalog on first run")
            await reload_registry(session)
        except Exception as exc:  # pragma: no cover
            # Don't block boot on a bad DB; admin can fix it via /api/v1/admin
            # once the app is up. Calls into the registry will see an empty
            # snapshot and the node handlers fall back to hardcoded defaults.
            logger.exception("AI registry init failed: %s", exc)

    yield


app = FastAPI(
    title="PixelFlow",
    description="AI Product Video Generation Platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: restrict in production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")
app.include_router(ws_router, prefix="/ws")


@app.get("/health")
async def health():
    return {"status": "ok"}
