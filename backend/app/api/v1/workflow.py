from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import GetDB
from app.core.celery_app import celery_app
from app.core.websocket_manager import websocket_manager
from app.models.project import Project, WorkflowNode, WorkflowRun
from app.schemas.models import GeneratePromptRequest, GeneratePromptResponse
from app.schemas.project import NodeConfigUpdate, NodeResponse
from app.schemas.workflow import (
    RetryResponse,
    StopAllResponse,
    WorkflowRunResponse,
    WorkflowStatusResponse,
)
from app.services.ai.model_registry import get_default_model
from app.services.service_container import service_container
from app.tasks.workflow import run_workflow
from app.workflow.prompts import get_default_prompt

router = APIRouter()


@router.post("/stop-all-workflows", response_model=StopAllResponse)
async def stop_all_workflows(db: AsyncSession = GetDB):
    """Cancel all currently running workflow projects."""
    result = await db.execute(
        select(Project).where(Project.status == "processing")
    )
    processing_projects = result.scalars().all()

    cancelled_count = 0
    now = datetime.now(timezone.utc)

    for project in processing_projects:
        project.status = "cancelled"

        node_result = await db.execute(
            select(WorkflowNode).where(
                WorkflowNode.project_id == project.id,
                WorkflowNode.status == "running",
            )
        )
        for node in node_result.scalars():
            node.status = "cancelled"
            node.completed_at = now

        pending_result = await db.execute(
            select(WorkflowNode).where(
                WorkflowNode.project_id == project.id,
                WorkflowNode.status == "pending",
            )
        )
        for node in pending_result.scalars():
            node.status = "cancelled"

        run_result = await db.execute(
            select(WorkflowRun).where(
                WorkflowRun.project_id == project.id,
                WorkflowRun.status == "running",
            )
        )
        for run in run_result.scalars():
            run.status = "cancelled"
            run.completed_at = now

            if run.celery_task_id:
                try:
                    celery_app.control.revoke(
                        run.celery_task_id,
                        terminate=True,
                        signal="SIGTERM",
                    )
                except Exception:
                    pass

        cancelled_count += 1

    await db.commit()

    for project in processing_projects:
        try:
            await websocket_manager.broadcast(
                project.id,
                {
                    "type": "workflow_cancelled",
                    "data": {
                        "project_id": project.id,
                        "message": "Workflow cancelled by user",
                    },
                },
            )
        except Exception:
            pass

    return StopAllResponse(cancelled_count=cancelled_count)


@router.post("/{project_id}/workflow/run", response_model=WorkflowRunResponse)
async def trigger_workflow(project_id: int, db: AsyncSession = GetDB):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status == "processing":
        raise HTTPException(status_code=409, detail="Workflow is already running")

    project.status = "processing"
    task = run_workflow.delay(project_id)

    run = WorkflowRun(
        project_id=project.id,
        status="running",
        celery_task_id=str(task.id),
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.commit()

    return WorkflowRunResponse(run_id=str(task.id), status="started")


@router.get("/{project_id}/workflow/status", response_model=WorkflowStatusResponse)
async def get_workflow_status(project_id: int, db: AsyncSession = GetDB):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    nodes_result = await db.execute(
        select(WorkflowNode)
        .where(WorkflowNode.project_id == project_id)
        .order_by(WorkflowNode.node_index)
    )
    nodes = nodes_result.scalars().all()

    return WorkflowStatusResponse(
        project_status=project.status,
        nodes=[
            {
                "id": n.id,
                "node_type": n.node_type,
                "node_index": n.node_index,
                "status": n.status,
                "output_json": n.output_json,
                "error_message": n.error_message,
                "debug_log": n.debug_log,
            }
            for n in nodes
        ],
    )


@router.get(
    "/{project_id}/workflow/nodes/{node_id}", response_model=NodeResponse
)
async def get_node_detail(
    project_id: int, node_id: int, db: AsyncSession = GetDB
):
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


@router.put(
    "/{project_id}/workflow/nodes/{node_id}/config", response_model=NodeResponse
)
async def update_node_config(
    project_id: int,
    node_id: int,
    body: NodeConfigUpdate,
    db: AsyncSession = GetDB,
):
    result = await db.execute(
        select(WorkflowNode).where(
            WorkflowNode.id == node_id,
            WorkflowNode.project_id == project_id,
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    if node.status == "running":
        raise HTTPException(status_code=409, detail="Cannot update config while node is running")

    node.config_json = body.config_json
    await db.commit()
    await db.refresh(node)
    return node


@router.post(
    "/{project_id}/workflow/nodes/{node_id}/retry", response_model=RetryResponse
)
async def retry_node(
    project_id: int, node_id: int, db: AsyncSession = GetDB
):
    result = await db.execute(
        select(WorkflowNode).where(
            WorkflowNode.id == node_id,
            WorkflowNode.project_id == project_id,
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()
    if project.status == "processing":
        raise HTTPException(status_code=409, detail="Workflow is already running")

    project.status = "processing"
    task = run_workflow.delay(project_id, from_node_index=node.node_index)

    run = WorkflowRun(
        project_id=project.id,
        status="running",
        celery_task_id=str(task.id),
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.commit()

    return RetryResponse(run_id=str(task.id), status="started")


@router.post(
    "/{project_id}/workflow/nodes/{node_id}/generate-prompt",
    response_model=GeneratePromptResponse,
)
async def generate_prompt(
    project_id: int,
    node_id: int,
    body: GeneratePromptRequest,
    db: AsyncSession = GetDB,
):
    """Use a meta-LLM to draft a professional user_prompt template for a node.

    The draft is returned, NOT saved — the user reviews and edits it before
    saving via the existing config endpoint.
    """
    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(WorkflowNode).where(
            WorkflowNode.id == node_id,
            WorkflowNode.project_id == project_id,
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    default_template = get_default_prompt(node.node_type)
    if not default_template:
        raise HTTPException(
            status_code=400,
            detail=f"Node type '{node.node_type}' does not support prompt customization",
        )

    upstream_outputs = await _collect_upstream_outputs(db, project_id, node.node_index)

    meta_model_entry = get_default_model("llm")
    meta_provider = meta_model_entry.provider if meta_model_entry else "qwen"
    meta_name = meta_model_entry.model_name if meta_model_entry else "qwen-max"
    text_model = service_container.get_text_model(meta_provider, meta_name)

    meta_system = (
        "You are a senior prompt engineer for an AI short-video pipeline. "
        "Given the goal of a pipeline node, the available upstream context, "
        "and the existing default prompt template, produce an improved "
        "user-prompt TEMPLATE. The template MUST keep the same Python "
        "str.format placeholders (e.g. {product_name}, {category}) so "
        "downstream variable substitution still works. Return ONLY the "
        "template text, no explanations, no markdown fences."
    )

    extra_block = ""
    if body.extra_instruction and body.extra_instruction.strip():
        extra_block = f"\n## Additional user instruction\n{body.extra_instruction.strip()}\n"

    upstream_block = (
        "\n## Sample upstream outputs (for context only — do NOT inline these into the template)\n"
        + (upstream_outputs or "(no upstream output yet)")
    )

    meta_prompt = f"""## Pipeline node
node_type: {node.node_type}

## Project
name: {project.name}
product_title: {project.product_title or ''}
product_description: {project.product_description or ''}

## Existing default template
{default_template}
{extra_block}{upstream_block}

Rewrite the user-prompt template above to be more specific, concrete and
professional for this node's job. Keep all existing {{placeholders}} intact
(do not invent new ones). Output ONLY the new template text."""

    raw = await text_model.generate_text(
        prompt=meta_prompt,
        system_prompt=meta_system,
        temperature=0.6,
        max_tokens=2048,
    )

    # Strip accidental code fences.
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1] if "\n" in cleaned else cleaned
        cleaned = cleaned.removesuffix("```").strip()

    return GeneratePromptResponse(
        user_prompt=cleaned or default_template,
        based_on=node.node_type,
    )


async def _collect_upstream_outputs(
    db: AsyncSession, project_id: int, current_node_index: int
) -> str:
    """Pull a compact JSON-ish summary of every upstream node's output_json."""
    import json

    result = await db.execute(
        select(WorkflowNode)
        .where(
            WorkflowNode.project_id == project_id,
            WorkflowNode.node_index < current_node_index,
        )
        .order_by(WorkflowNode.node_index)
    )
    nodes = result.scalars().all()
    chunks: list[str] = []
    for n in nodes:
        if not n.output_json:
            continue
        try:
            blob = json.dumps(n.output_json, ensure_ascii=False, indent=2)
        except (TypeError, ValueError):
            blob = str(n.output_json)
        # Cap each upstream block so a giant storyboard JSON doesn't blow up
        # the meta-prompt.
        if len(blob) > 1500:
            blob = blob[:1500] + " …(truncated)"
        chunks.append(f"### {n.node_type}\n{blob}")
    return "\n\n".join(chunks)
