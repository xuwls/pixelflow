"""Admin CRUD for AI provider + model registry.

No authentication — keys never leave the server (the workflow runs
calls server-side), so the surface area exposed to a malicious caller
is just "could mess with our model catalog". Add `X-Admin-Token` later
if/when this is reachable from outside the LAN.

Mounted at /api/v1/admin in router.py.

GET responses mask api_key (sk-***last4) — POST/PATCH let the caller
pass a new value to overwrite, or omit to leave unchanged.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import GetDB
from app.models.ai_registry import AIModel, AIProvider
from app.schemas.admin import (
    ModelCreate,
    ModelResponse,
    ModelUpdate,
    ProviderCreate,
    ProviderResponse,
    ProviderUpdate,
)
from app.services.ai.model_registry import reload_registry
from app.services.service_container import service_container

logger = logging.getLogger(__name__)

router = APIRouter()


_VALID_CAPABILITIES = {"文字编辑/生成", "图片编辑/生成", "视频编辑/生成"}


def _mask_api_key(api_key: str) -> str:
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "***"
    return f"{api_key[:3]}***{api_key[-4:]}"


def _provider_to_response(p: AIProvider) -> ProviderResponse:
    return ProviderResponse(
        id=p.id,
        name=p.name,
        display_name=p.display_name,
        api_key_masked=_mask_api_key(p.api_key or ""),
        has_api_key=bool(p.api_key),
        base_url=p.base_url,
        enabled=p.enabled,
        description=p.description,
    )


def _model_to_response(m: AIModel, provider_name: str) -> ModelResponse:
    return ModelResponse(
        id=m.id,
        provider_id=m.provider_id,
        provider_name=provider_name,
        capability=m.capability,
        model_name=m.model_name,
        display_name=m.display_name,
        is_default=m.is_default,
        default_params=dict(m.default_params or {}),
        description=m.description,
        enabled=m.enabled,
        sort_order=m.sort_order,
    )


async def _refresh_after_write(db: AsyncSession) -> None:
    """Reload registry snapshot + drop cached AI clients.

    Called after any mutation so the next workflow run sees the change.
    """
    await reload_registry(db)
    service_container.invalidate()


# ── Providers ─────────────────────────────────────────────────────────
@router.get("/providers", response_model=list[ProviderResponse])
async def list_providers(db: AsyncSession = GetDB):
    result = await db.execute(select(AIProvider).order_by(AIProvider.id))
    return [_provider_to_response(p) for p in result.scalars().all()]


@router.post("/providers", response_model=ProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(payload: ProviderCreate, db: AsyncSession = GetDB):
    existing = await db.execute(select(AIProvider).where(AIProvider.name == payload.name))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Provider '{payload.name}' already exists")

    provider = AIProvider(
        name=payload.name,
        display_name=payload.display_name,
        api_key=payload.api_key or "",
        base_url=payload.base_url,
        enabled=payload.enabled,
        description=payload.description,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    await _refresh_after_write(db)
    return _provider_to_response(provider)


@router.get("/providers/{provider_id}", response_model=ProviderResponse)
async def get_provider(provider_id: int, db: AsyncSession = GetDB):
    provider = await db.get(AIProvider, provider_id)
    if provider is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Provider not found")
    return _provider_to_response(provider)


@router.patch("/providers/{provider_id}", response_model=ProviderResponse)
async def update_provider(
    provider_id: int, payload: ProviderUpdate, db: AsyncSession = GetDB
):
    provider = await db.get(AIProvider, provider_id)
    if provider is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Provider not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(provider, field, value)

    await db.commit()
    await db.refresh(provider)
    await _refresh_after_write(db)
    return _provider_to_response(provider)


@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(provider_id: int, db: AsyncSession = GetDB):
    provider = await db.get(AIProvider, provider_id)
    if provider is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Provider not found")

    # CASCADE on FK takes care of associated models.
    await db.delete(provider)
    await db.commit()
    await _refresh_after_write(db)


# ── Models ────────────────────────────────────────────────────────────
@router.get("/models", response_model=list[ModelResponse])
async def list_admin_models(db: AsyncSession = GetDB):
    """Admin variant that includes disabled rows + provider id."""
    stmt = (
        select(AIModel)
        .options(selectinload(AIModel.provider))
        .order_by(AIModel.capability, AIModel.sort_order, AIModel.id)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [_model_to_response(m, m.provider.name if m.provider else "") for m in rows]


@router.post("/models", response_model=ModelResponse, status_code=status.HTTP_201_CREATED)
async def create_model(payload: ModelCreate, db: AsyncSession = GetDB):
    if payload.capability not in _VALID_CAPABILITIES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"capability must be one of {sorted(_VALID_CAPABILITIES)}",
        )

    provider = await db.get(AIProvider, payload.provider_id)
    if provider is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "provider_id does not exist")

    duplicate = await db.execute(
        select(AIModel).where(
            AIModel.provider_id == payload.provider_id,
            AIModel.model_name == payload.model_name,
        )
    )
    if duplicate.scalar_one_or_none() is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Model '{payload.model_name}' already exists under this provider",
        )

    if payload.is_default:
        await _clear_other_defaults(db, payload.capability)

    model = AIModel(
        provider_id=payload.provider_id,
        capability=payload.capability,
        model_name=payload.model_name,
        display_name=payload.display_name,
        is_default=payload.is_default,
        default_params=payload.default_params,
        description=payload.description,
        enabled=payload.enabled,
        sort_order=payload.sort_order,
    )
    db.add(model)
    await db.commit()
    await db.refresh(model, attribute_names=["provider"])
    await _refresh_after_write(db)
    return _model_to_response(model, model.provider.name)


@router.get("/models/{model_id}", response_model=ModelResponse)
async def get_admin_model(model_id: int, db: AsyncSession = GetDB):
    stmt = select(AIModel).options(selectinload(AIModel.provider)).where(AIModel.id == model_id)
    result = await db.execute(stmt)
    model = result.scalar_one_or_none()
    if model is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model not found")
    return _model_to_response(model, model.provider.name)


@router.patch("/models/{model_id}", response_model=ModelResponse)
async def update_model(model_id: int, payload: ModelUpdate, db: AsyncSession = GetDB):
    stmt = select(AIModel).options(selectinload(AIModel.provider)).where(AIModel.id == model_id)
    result = await db.execute(stmt)
    model = result.scalar_one_or_none()
    if model is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model not found")

    data = payload.model_dump(exclude_unset=True)

    if "capability" in data and data["capability"] not in _VALID_CAPABILITIES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"capability must be one of {sorted(_VALID_CAPABILITIES)}",
        )

    new_default = data.get("is_default", model.is_default)
    target_capability = data.get("capability", model.capability)
    if new_default:
        await _clear_other_defaults(db, target_capability, exclude_id=model.id)

    for field, value in data.items():
        setattr(model, field, value)

    await db.commit()
    await db.refresh(model, attribute_names=["provider"])
    await _refresh_after_write(db)
    return _model_to_response(model, model.provider.name)


@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(model_id: int, db: AsyncSession = GetDB):
    model = await db.get(AIModel, model_id)
    if model is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model not found")

    await db.delete(model)
    await db.commit()
    await _refresh_after_write(db)


async def _clear_other_defaults(
    db: AsyncSession, capability: str, exclude_id: int | None = None
) -> None:
    """Ensure at most one is_default=True per capability."""
    stmt = select(AIModel).where(
        AIModel.capability == capability, AIModel.is_default.is_(True)
    )
    if exclude_id is not None:
        stmt = stmt.where(AIModel.id != exclude_id)
    result = await db.execute(stmt)
    for other in result.scalars().all():
        other.is_default = False
