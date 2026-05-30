from typing import Optional

from pydantic import BaseModel


class ModelEntryResponse(BaseModel):
    capability: str
    provider: str
    model_name: str
    display_name: str
    is_default: bool = False
    default_params: dict = {}
    param_constraints: dict = {}
    description: str = ""


class ModelListResponse(BaseModel):
    capability: Optional[str] = None
    models: list[ModelEntryResponse]

