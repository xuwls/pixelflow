from typing import Optional

from pydantic import BaseModel


class WorkflowRunResponse(BaseModel):
    run_id: str
    status: str


class WorkflowStatusResponse(BaseModel):
    project_status: str
    nodes: list[dict]


class RetryResponse(BaseModel):
    run_id: str
    status: str


class StopAllResponse(BaseModel):
    cancelled_count: int
