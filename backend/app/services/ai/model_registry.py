"""Model registry.

DB-backed catalog with an in-memory snapshot for hot-path reads.

Public surface:
    * `ModelEntry` dataclass — carries `api_key` / `base_url` resolved from
      the owning provider so callers don't have to look those up.
    * `list_models(capability=None) -> list[ModelEntry]`
    * `get_model(provider, model_name) -> ModelEntry | None`
    * `get_default_model(capability) -> ModelEntry | None`

Reads go against an in-memory snapshot (`_SNAPSHOT`) refreshed via
`reload_registry(session)`. The FastAPI lifespan hook calls it on startup
and admin CRUD routes call it after writes so a freshly-added model is
visible immediately without a restart.
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
    param_constraints: dict[str, Any] = field(default_factory=dict)
    description: str = ""
    api_key: str = ""
    base_url: str | None = None


# ── In-memory snapshot ────────────────────────────────────────────────
_SNAPSHOT: list[ModelEntry] = []


def _constraints_for_model(model_name: str, capability: str) -> dict[str, Any]:
    """Derive parameter constraints from model name and capability."""
    if capability == "图片编辑/生成":
        # 通义万相图片模型
        if model_name.startswith("wanx2.1"):
            return {"supported_sizes": [[1024, 1024], [720, 1280], [1280, 720], [768, 1152], [1152, 768]]}
        return {"supported_sizes": [[1024, 1024], [720, 1280], [1280, 720]]}

    if capability == "视频编辑/生成":
        # 通义万相视频模型
        if model_name.startswith("wan"):
            return {"supported_resolutions": [720, 1080], "duration_range": [1, 5]}
        # 其他视频模型默认
        return {"supported_resolutions": [720, 1080], "duration_range": [1, 10]}

    return {}


def _entry_from_row(model: AIModel, provider: AIProvider) -> ModelEntry:
    return ModelEntry(
        capability=model.capability,  # type: ignore[arg-type]
        provider=provider.name,
        model_name=model.model_name,
        display_name=model.display_name,
        is_default=model.is_default,
        default_params=dict(model.default_params or {}),
        param_constraints=_constraints_for_model(model.model_name, model.capability),
        description=model.description or "",
        api_key=provider.api_key or "",
        base_url=provider.base_url,
    )


async def reload_registry(session: AsyncSession) -> int:
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


def snapshot_size() -> int:
    return len(_SNAPSHOT)

