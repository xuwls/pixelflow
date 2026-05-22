from typing import Optional

from pydantic import BaseModel


class ModelEntryResponse(BaseModel):
    capability: str
    provider: str
    model_name: str
    display_name: str
    is_default: bool = False
    default_params: dict = {}
    description: str = ""


class ModelListResponse(BaseModel):
    capability: Optional[str] = None
    models: list[ModelEntryResponse]


class NodeCapabilityResponse(BaseModel):
    node_type: str
    capabilities: list[str]
    default_capability: Optional[str] = None


class GeneratePromptRequest(BaseModel):
    extra_instruction: Optional[str] = None
    capability: Optional[str] = None


class GeneratePromptResponse(BaseModel):
    user_prompt: str
    based_on: str
