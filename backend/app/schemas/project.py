from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


NodeKind = Literal["text", "image", "video"]
NodeStatus = Literal["idle", "running", "completed", "failed", "cancelled"]


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


class NodeResponse(BaseModel):
    id: int
    project_id: int
    kind: NodeKind
    title: Optional[str] = None
    position_x: float
    position_y: float
    prompt: Optional[str] = None
    status: NodeStatus
    config_json: Optional[dict] = None
    output_json: Optional[dict] = None
    error_message: Optional[str] = None
    debug_log: Optional[dict] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EdgeResponse(BaseModel):
    id: int
    project_id: int
    source_node_id: int
    target_node_id: int

    model_config = {"from_attributes": True}


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


class ProjectDetailResponse(ProjectResponse):
    nodes: list[NodeResponse] = []
    edges: list[EdgeResponse] = []
    media_files: list[MediaResponse] = []


class NodeCreate(BaseModel):
    kind: NodeKind
    title: Optional[str] = None
    position_x: float = 0.0
    position_y: float = 0.0
    prompt: Optional[str] = None
    config_json: Optional[dict] = None
    output_json: Optional[dict] = None
    status: Optional[NodeStatus] = None


class NodeUpdate(BaseModel):
    title: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    prompt: Optional[str] = None
    config_json: Optional[dict] = None
    output_json: Optional[dict] = None


class NodePositionsUpdate(BaseModel):
    positions: list["NodePosition"]


class NodePosition(BaseModel):
    id: int
    position_x: float
    position_y: float


class EdgeCreate(BaseModel):
    source_node_id: int
    target_node_id: int


NodePositionsUpdate.model_rebuild()
