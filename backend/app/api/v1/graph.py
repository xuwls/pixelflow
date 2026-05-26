from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import GetDB
from app.models.project import MediaFile, Project, WorkflowEdge, WorkflowNode
from app.schemas.project import (
    EdgeCreate,
    EdgeResponse,
    MediaResponse,
    NodeCreate,
    NodePositionsUpdate,
    NodeResponse,
    NodeUpdate,
)
from app.services.storage import storage_service

router = APIRouter()


# ── nodes ─────────────────────────────────────────────────────────────


@router.post("/{project_id}/nodes", response_model=NodeResponse, status_code=201)
async def create_node(project_id: int, body: NodeCreate, db: AsyncSession = GetDB):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    node = WorkflowNode(
        project_id=project_id,
        kind=body.kind,
        title=body.title,
        position_x=body.position_x,
        position_y=body.position_y,
        prompt=body.prompt,
        config_json=body.config_json or {},
        output_json=body.output_json,
        status=body.status or ("completed" if body.output_json else "idle"),
    )
    if node.status == "completed" and node.output_json:
        node.completed_at = datetime.now(timezone.utc)
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


@router.patch("/{project_id}/nodes/{node_id}", response_model=NodeResponse)
async def update_node(
    project_id: int,
    node_id: int,
    body: NodeUpdate,
    db: AsyncSession = GetDB,
):
    node = await _get_node(db, project_id, node_id)

    if body.title is not None:
        node.title = body.title
    if body.position_x is not None:
        node.position_x = body.position_x
    if body.position_y is not None:
        node.position_y = body.position_y
    if body.prompt is not None:
        node.prompt = body.prompt
    if body.config_json is not None:
        node.config_json = body.config_json
    if body.output_json is not None:
        node.output_json = body.output_json

    await db.commit()
    await db.refresh(node)
    return node


@router.put("/{project_id}/nodes/positions", response_model=list[NodeResponse])
async def update_positions(
    project_id: int, body: NodePositionsUpdate, db: AsyncSession = GetDB
):
    """Bulk-write positions after a drag — keeps the canvas snappy on large graphs."""
    if not body.positions:
        return []
    ids = [p.id for p in body.positions]
    result = await db.execute(
        select(WorkflowNode).where(
            WorkflowNode.project_id == project_id,
            WorkflowNode.id.in_(ids),
        )
    )
    by_id = {n.id: n for n in result.scalars()}
    updated: list[WorkflowNode] = []
    for p in body.positions:
        n = by_id.get(p.id)
        if n is None:
            continue
        n.position_x = p.position_x
        n.position_y = p.position_y
        updated.append(n)
    await db.commit()
    for n in updated:
        await db.refresh(n)
    return updated


@router.delete("/{project_id}/nodes/{node_id}")
async def delete_node(project_id: int, node_id: int, db: AsyncSession = GetDB):
    node = await _get_node(db, project_id, node_id)

    media_result = await db.execute(
        select(MediaFile).where(MediaFile.node_id == node_id)
    )
    for media in media_result.scalars():
        try:
            await storage_service.delete_file(media.file_url)
        except Exception:
            pass
        await db.delete(media)

    # edges are cascade-deleted via FK
    await db.delete(node)
    await db.commit()
    return {"deleted": True}


@router.post(
    "/{project_id}/nodes/{node_id}/upload",
    response_model=NodeResponse,
)
async def upload_node_asset(
    project_id: int,
    node_id: int,
    file: UploadFile,
    db: AsyncSession = GetDB,
):
    """Attach a user-uploaded asset to an asset-mode node.

    Stores the bytes in MinIO and writes the resulting object key into the
    node's `output_json` so downstream nodes can consume it like any other
    output. Also records a MediaFile row for cleanup tracking.
    """
    node = await _get_node(db, project_id, node_id)
    content = await file.read()
    content_type = file.content_type or "application/octet-stream"

    object_key = await storage_service.upload_file(
        key=f"projects/{project_id}/nodes/{node_id}/{file.filename}",
        file_obj=content,
        content_type=content_type,
    )

    media = MediaFile(
        project_id=project_id,
        node_id=node_id,
        file_type=node.kind,
        file_name=file.filename,
        file_url=object_key,
        file_size=len(content),
        mime_type=content_type,
    )
    db.add(media)

    output: dict = {
        "url": object_key,
        "file_name": file.filename,
        "mime_type": content_type,
        "size": len(content),
    }
    if node.kind == "image":
        output["images"] = [{"url": object_key}]
    elif node.kind == "video":
        output["videos"] = [{"url": object_key}]

    node.output_json = output
    node.status = "completed"
    node.completed_at = datetime.now(timezone.utc)
    node.error_message = None
    await db.commit()
    await db.refresh(node)
    return node


@router.get(
    "/{project_id}/nodes/{node_id}/asset",
    response_model=MediaResponse,
)
async def get_node_asset(project_id: int, node_id: int, db: AsyncSession = GetDB):
    """Most recent uploaded asset for a node — used by the inspector preview."""
    await _get_node(db, project_id, node_id)
    result = await db.execute(
        select(MediaFile)
        .where(MediaFile.node_id == node_id)
        .order_by(MediaFile.created_at.desc())
        .limit(1)
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="No asset for this node")
    return media


# ── edges ─────────────────────────────────────────────────────────────


@router.post("/{project_id}/edges", response_model=EdgeResponse, status_code=201)
async def create_edge(project_id: int, body: EdgeCreate, db: AsyncSession = GetDB):
    if body.source_node_id == body.target_node_id:
        raise HTTPException(status_code=400, detail="source and target must differ")

    nodes_result = await db.execute(
        select(WorkflowNode).where(
            WorkflowNode.project_id == project_id,
            WorkflowNode.id.in_([body.source_node_id, body.target_node_id]),
        )
    )
    found = {n.id for n in nodes_result.scalars()}
    if {body.source_node_id, body.target_node_id} - found:
        raise HTTPException(status_code=404, detail="Node not found in this project")

    existing = await db.execute(
        select(WorkflowEdge).where(
            WorkflowEdge.project_id == project_id,
            WorkflowEdge.source_node_id == body.source_node_id,
            WorkflowEdge.target_node_id == body.target_node_id,
        )
    )
    edge = existing.scalar_one_or_none()
    if edge:
        return edge

    if await _would_create_cycle(db, project_id, body.source_node_id, body.target_node_id):
        raise HTTPException(status_code=409, detail="This connection would create a cycle")

    edge = WorkflowEdge(
        project_id=project_id,
        source_node_id=body.source_node_id,
        target_node_id=body.target_node_id,
    )
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return edge


@router.delete("/{project_id}/edges/{edge_id}")
async def delete_edge(project_id: int, edge_id: int, db: AsyncSession = GetDB):
    result = await db.execute(
        select(WorkflowEdge).where(
            WorkflowEdge.id == edge_id,
            WorkflowEdge.project_id == project_id,
        )
    )
    edge = result.scalar_one_or_none()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    await db.delete(edge)
    await db.commit()
    return {"deleted": True}


# ── helpers ───────────────────────────────────────────────────────────


async def _get_node(db: AsyncSession, project_id: int, node_id: int) -> WorkflowNode:
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


async def _would_create_cycle(
    db: AsyncSession, project_id: int, source_id: int, target_id: int
) -> bool:
    """Return True if adding source→target would form a cycle.

    DFS from `target` following existing edges; if we ever land on `source`,
    inserting the new edge would close a loop.
    """
    result = await db.execute(
        select(WorkflowEdge.source_node_id, WorkflowEdge.target_node_id).where(
            WorkflowEdge.project_id == project_id
        )
    )
    adj: dict[int, list[int]] = {}
    for s, t in result.all():
        adj.setdefault(s, []).append(t)

    stack = [target_id]
    seen: set[int] = set()
    while stack:
        cur = stack.pop()
        if cur == source_id:
            return True
        if cur in seen:
            continue
        seen.add(cur)
        stack.extend(adj.get(cur, []))
    return False
