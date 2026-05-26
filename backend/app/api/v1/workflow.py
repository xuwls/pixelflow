"""Per-node execution API.

The workflow is now a free-form DAG built by the user. Each generation
node is executed individually via POST /projects/{id}/nodes/{nid}/run —
no global pipeline scheduler.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import GetDB
from app.core.celery_app import celery_app
from app.core.websocket_manager import websocket_manager
from app.models.project import Project, WorkflowNode, WorkflowRun
from app.schemas.project import NodeResponse
from app.schemas.workflow import StopAllResponse, WorkflowRunResponse
from app.tasks.workflow import run_node

router = APIRouter()


@router.post("/stop-all-workflows", response_model=StopAllResponse)
async def stop_all_workflows(db: AsyncSession = GetDB):
    """Cancel every node currently executing across all projects."""
    now = datetime.now(timezone.utc)

    node_result = await db.execute(
        select(WorkflowNode).where(WorkflowNode.status == "running")
    )
    running_nodes = list(node_result.scalars())

    cancelled = 0
    affected_projects: set[int] = set()
    for node in running_nodes:
        node.status = "cancelled"
        node.completed_at = now
        affected_projects.add(node.project_id)
        cancelled += 1

    run_result = await db.execute(
        select(WorkflowRun).where(WorkflowRun.status == "running")
    )
    for run in run_result.scalars():
        run.status = "cancelled"
        run.completed_at = now
        if run.celery_task_id:
            try:
                celery_app.control.revoke(
                    run.celery_task_id, terminate=True, signal="SIGTERM"
                )
            except Exception:
                pass

    proj_result = await db.execute(
        select(Project).where(Project.status == "processing")
    )
    for project in proj_result.scalars():
        project.status = "draft"
        affected_projects.add(project.id)

    await db.commit()

    for pid in affected_projects:
        try:
            await websocket_manager.broadcast(
                pid,
                {
                    "type": "workflow_cancelled",
                    "data": {"project_id": pid, "message": "Cancelled by user"},
                },
            )
        except Exception:
            pass

    return StopAllResponse(cancelled_count=cancelled)


@router.post(
    "/{project_id}/nodes/{node_id}/run", response_model=WorkflowRunResponse
)
async def run_single_node(
    project_id: int, node_id: int, db: AsyncSession = GetDB
):
    """Queue a single generation node. Asset nodes have nothing to run."""
    project = (
        await db.execute(select(Project).where(Project.id == project_id))
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    node = (
        await db.execute(
            select(WorkflowNode).where(
                WorkflowNode.id == node_id,
                WorkflowNode.project_id == project_id,
            )
        )
    ).scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    if node.status == "running":
        raise HTTPException(status_code=409, detail="Node is already running")
    if not (node.prompt and node.prompt.strip()):
        raise HTTPException(
            status_code=400,
            detail="Node has no prompt — upload an asset or set a prompt first",
        )

    node.status = "running"
    node.started_at = datetime.now(timezone.utc)
    node.error_message = None
    node.output_json = None

    project.status = "processing"

    task = run_node.delay(project_id, node_id)
    run = WorkflowRun(
        project_id=project_id,
        node_id=node_id,
        status="running",
        celery_task_id=str(task.id),
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.commit()
    await db.refresh(node)

    try:
        await websocket_manager.broadcast(
            project_id,
            {
                "type": "node_status",
                "data": {
                    "node_id": node.id,
                    "status": node.status,
                    "kind": node.kind,
                },
            },
        )
    except Exception:
        pass

    return WorkflowRunResponse(run_id=str(task.id), status="started")


@router.get(
    "/{project_id}/nodes/{node_id}", response_model=NodeResponse
)
async def get_node(project_id: int, node_id: int, db: AsyncSession = GetDB):
    result = await db.execute(
        select(WorkflowNode).where(
            WorkflowNode.id == node_id,
            WorkflowNode.project_id == project_id,
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node
