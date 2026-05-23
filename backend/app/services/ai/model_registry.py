"""Model & node-capability registry.

DB-backed catalog with an in-memory snapshot for hot-path reads.

Public surface (unchanged from the previous Python-constant version):
    * `ModelEntry` dataclass — now also carries `api_key` / `base_url` resolved
      from the owning provider so callers don't have to look those up.
    * `list_models(capability=None) -> list[ModelEntry]`
    * `get_model(provider, model_name) -> ModelEntry | None`
    * `get_default_model(capability) -> ModelEntry | None`
    * `node_capabilities(node_type) -> list[Capability]`
    * `NODE_CAPABILITY`, `NODE_ALT_CAPABILITIES`

Reads go against an in-memory snapshot (`_SNAPSHOT`) refreshed via
`reload_registry(session)`. The FastAPI lifespan hook calls
`reload_registry` on startup; admin CRUD routes call it after writes
so a freshly-added model is visible immediately without a restart.

Node→capability mapping stays in code on purpose: the workflow steps
are defined by the pipeline, not by what models happen to be in the DB.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_registry import AIModel, AIProvider

logger = logging.getLogger(__name__)

Capability = Literal["文字编辑/生成", "图片编辑/生成", "视频编辑/生成"]


@dataclass(frozen=True)
class ModelEntry:
    capability: Capability
    provider: str
    model_name: str
    display_name: str
    is_default: bool = False
    default_params: dict[str, Any] = field(default_factory=dict)
    description: str = ""
    # Credentials resolved from the owning provider row. Callers that
    # construct AI clients should pass these straight through instead of
    # reading settings.DASHSCOPE_API_KEY.
    api_key: str = ""
    base_url: str | None = None


# ── Pipeline node → capability map (intentionally lives in code) ──────
NODE_CAPABILITY: dict[str, Capability] = {
    "product_understanding": "文字编辑/生成",
    "selling_point": "文字编辑/生成",
    "script": "文字编辑/生成",
    "storyboard": "文字编辑/生成",
    "prompt": "文字编辑/生成",
    "keyframe": "图片编辑/生成",
    "video_generation": "视频编辑/生成",
    "voiceover": "文字编辑/生成",
}

NODE_ALT_CAPABILITIES: dict[str, list[Capability]] = {}


# ── In-memory snapshot ────────────────────────────────────────────────
_SNAPSHOT: list[ModelEntry] = []


def _entry_from_row(model: AIModel, provider: AIProvider) -> ModelEntry:
    return ModelEntry(
        capability=model.capability,  # type: ignore[arg-type]
        provider=provider.name,
        model_name=model.model_name,
        display_name=model.display_name,
        is_default=model.is_default,
        default_params=dict(model.default_params or {}),
        description=model.description or "",
        api_key=provider.api_key or "",
        base_url=provider.base_url,
    )


async def reload_registry(session: AsyncSession) -> int:
    """Pull the catalog from DB into the in-memory snapshot.

    Returns the number of models loaded. Call this on startup and after
    any admin write.
    """
    global _SNAPSHOT
    stmt = (
        select(AIModel)
        .options(selectinload(AIModel.provider))
        .where(AIModel.enabled.is_(True))
        .order_by(
            AIModel.capability,
            AIModel.is_default.desc(),
            AIModel.sort_order,
            AIModel.id,
        )
    )
    result = await session.execute(stmt)
    rows = result.scalars().all()
    snapshot = [
        _entry_from_row(m, m.provider)
        for m in rows
        if m.provider is not None and m.provider.enabled
    ]
    _SNAPSHOT = snapshot
    logger.info("Model registry reloaded: %d entries", len(snapshot))
    return len(snapshot)


# ── Read API (unchanged signatures) ───────────────────────────────────
def list_models(capability: Capability | None = None) -> list[ModelEntry]:
    if capability is None:
        return list(_SNAPSHOT)
    return [m for m in _SNAPSHOT if m.capability == capability]


def get_model(provider: str, model_name: str) -> ModelEntry | None:
    for m in _SNAPSHOT:
        if m.provider == provider and m.model_name == model_name:
            return m
    return None


def get_default_model(capability: Capability) -> ModelEntry | None:
    for m in _SNAPSHOT:
        if m.capability == capability and m.is_default:
            return m
    candidates = list_models(capability)
    return candidates[0] if candidates else None


def node_capabilities(node_type: str) -> list[Capability]:
    if node_type in NODE_ALT_CAPABILITIES:
        return list(NODE_ALT_CAPABILITIES[node_type])
    cap = NODE_CAPABILITY.get(node_type)
    return [cap] if cap else []


def snapshot_size() -> int:
    return len(_SNAPSHOT)
