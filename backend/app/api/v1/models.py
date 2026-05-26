"""Public read-only catalog endpoints for the model registry."""

from fastapi import APIRouter, Query

from app.schemas.models import (
    ModelEntryResponse,
    ModelListResponse,
)
from app.services.ai.model_registry import list_models

router = APIRouter()


@router.get("/models", response_model=ModelListResponse)
async def get_models(
    capability: str | None = Query(
        default=None,
        description="Filter by capability (文字编辑/生成 | 图片编辑/生成 | 视频编辑/生成).",
    ),
):
    entries = list_models(capability)  # type: ignore[arg-type]
    return ModelListResponse(
        capability=capability,
        models=[
            ModelEntryResponse(
                capability=m.capability,
                provider=m.provider,
                model_name=m.model_name,
                display_name=m.display_name,
                is_default=m.is_default,
                default_params=m.default_params,
                description=m.description,
            )
            for m in entries
        ],
    )
