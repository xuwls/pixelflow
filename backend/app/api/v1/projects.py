from fastapi import APIRouter, HTTPException, UploadFile
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import GetDB
from app.models.project import MediaFile, Project, WorkflowNode
from app.schemas.project import (
    MediaResponse,
    ProjectCreate,
    ProjectDetailResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.storage import storage_service
from app.workflow.pipeline import PIPELINE

router = APIRouter()


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = GetDB):
    project = Project(
        name=body.name,
        product_title=body.product_title,
        product_description=body.product_description,
    )
    db.add(project)
    await db.flush()

    for i, pnode in enumerate(PIPELINE):
        node = WorkflowNode(
            project_id=project.id,
            node_type=pnode.node_type,
            node_index=i,
            config_json=pnode.default_config.copy() if pnode.default_config else {},
        )
        db.add(node)

    await db.commit()
    await db.refresh(project)
    return project


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    page: int = 1,
    size: int = 20,
    db: AsyncSession = GetDB,
):
    stmt = (
        select(Project)
        .order_by(Project.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(project_id: int, db: AsyncSession = GetDB):
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.nodes),
            selectinload(Project.media_files),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int, body: ProjectUpdate, db: AsyncSession = GetDB
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if body.name is not None:
        project.name = body.name
    if body.product_title is not None:
        project.product_title = body.product_title
    if body.product_description is not None:
        project.product_description = body.product_description
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: int, db: AsyncSession = GetDB):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    file_result = await db.execute(
        select(MediaFile.file_url).where(MediaFile.project_id == project_id)
    )
    for file_url in file_result.scalars():
        try:
            await storage_service.delete_file(file_url)
        except Exception:
            pass

    await db.execute(text("DELETE FROM media_file WHERE project_id = :pid"), {"pid": project_id})
    await db.execute(text("DELETE FROM workflow_node WHERE project_id = :pid"), {"pid": project_id})
    await db.execute(text("DELETE FROM workflow_run WHERE project_id = :pid"), {"pid": project_id})
    await db.execute(text("DELETE FROM project WHERE id = :pid"), {"pid": project_id})
    await db.commit()
    return {"deleted": True}


@router.post("/{project_id}/upload", response_model=MediaResponse)
async def upload_product_image(
    project_id: int,
    file: UploadFile,
    db: AsyncSession = GetDB,
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    content_type = file.content_type or "application/octet-stream"

    object_key = await storage_service.upload_file(
        key=f"projects/{project_id}/product/{file.filename}",
        file_obj=content,
        content_type=content_type,
    )

    media = MediaFile(
        project_id=project_id,
        file_type="product_image",
        file_name=file.filename,
        file_url=object_key,
        file_size=len(content),
        mime_type=content_type,
    )
    db.add(media)

    if not project.cover_url:
        project.cover_url = object_key

    await db.commit()
    await db.refresh(media)
    return media
