from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    product_title: Optional[str] = None
    product_description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    product_title: Optional[str] = None
    product_description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    cover_url: Optional[str] = None
    product_title: Optional[str] = None
    product_description: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectDetailResponse(ProjectResponse):
    nodes: list["NodeResponse"] = []
    media_files: list["MediaResponse"] = []


class NodeResponse(BaseModel):
    id: int
    project_id: int
    node_type: str
    node_index: int
    status: str
    config_json: Optional[dict] = None
    input_json: Optional[dict] = None
    output_json: Optional[dict] = None
    error_message: Optional[str] = None
    debug_log: Optional[dict] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class NodeConfigUpdate(BaseModel):
    config_json: dict


class MediaResponse(BaseModel):
    id: int
    project_id: int
    node_id: Optional[int] = None
    file_type: str
    file_name: str
    file_url: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    scene_index: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}
