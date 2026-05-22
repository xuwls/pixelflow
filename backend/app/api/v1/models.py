"""Public read-only catalog endpoints: model registry + node capability map."""

from fastapi import APIRouter, Query

from app.schemas.models import (
    ModelEntryResponse,
    ModelListResponse,
    NodeCapabilityResponse,
)
from app.services.ai.model_registry import (
    NODE_ALT_CAPABILITIES,
    NODE_CAPABILITY,
    list_models,
    node_capabilities,
)

router = APIRouter()


@router.get("/models", response_model=ModelListResponse)
async def get_models(
    capability: str | None = Query(
        default=None,
        description="Filter by capability (vl/llm/t2i/i2i/i2v/t2v/tts).",
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


@router.get("/node-capabilities", response_model=list[NodeCapabilityResponse])
async def get_node_capabilities():
    """Tells the frontend which capability each node consumes.

    Frontend uses this to filter the model dropdown per-node.
    """
    out: list[NodeCapabilityResponse] = []
    seen: set[str] = set()

    for node_type, _cap in NODE_CAPABILITY.items():
        caps = node_capabilities(node_type)
        out.append(
            NodeCapabilityResponse(
                node_type=node_type,
                capabilities=caps,
                default_capability=caps[0] if caps else None,
            )
        )
        seen.add(node_type)

    for node_type, caps in NODE_ALT_CAPABILITIES.items():
        if node_type in seen:
            continue
        out.append(
            NodeCapabilityResponse(
                node_type=node_type,
                capabilities=list(caps),
                default_capability=caps[0] if caps else None,
            )
        )

    return out
