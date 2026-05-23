from typing import Optional

from pydantic import BaseModel, Field


# ── Provider ───────────────────────────────────────────────────────────
class ProviderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=64,
                       description="Stable internal id, e.g. 'qwen_vl'. Code references this.")
    display_name: str = Field(..., min_length=1, max_length=128)
    api_key: str = ""
    base_url: Optional[str] = None
    enabled: bool = True
    description: Optional[str] = None


class ProviderCreate(ProviderBase):
    pass


class ProviderUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    enabled: Optional[bool] = None
    description: Optional[str] = None


class ProviderResponse(BaseModel):
    id: int
    name: str
    display_name: str
    api_key_masked: str
    has_api_key: bool
    base_url: Optional[str]
    enabled: bool
    description: Optional[str]


# ── Model ──────────────────────────────────────────────────────────────
class ModelBase(BaseModel):
    provider_id: int
    capability: str = Field(..., description="文字编辑/生成 | 图片编辑/生成 | 视频编辑/生成")
    model_name: str = Field(..., min_length=1, max_length=128)
    display_name: str = Field(..., min_length=1, max_length=128)
    is_default: bool = False
    default_params: dict = Field(default_factory=dict)
    description: Optional[str] = None
    enabled: bool = True
    sort_order: int = 0


class ModelCreate(ModelBase):
    pass


class ModelUpdate(BaseModel):
    capability: Optional[str] = None
    model_name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    is_default: Optional[bool] = None
    default_params: Optional[dict] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    sort_order: Optional[int] = None


class ModelResponse(BaseModel):
    id: int
    provider_id: int
    provider_name: str
    capability: str
    model_name: str
    display_name: str
    is_default: bool
    default_params: dict
    description: Optional[str]
    enabled: bool
    sort_order: int
