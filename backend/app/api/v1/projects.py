from fastapi import APIRouter, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import GetDB
from app.models.project import MediaFile, Project, WorkflowEdge, WorkflowNode
from app.schemas.project import (
    ProjectCreate,
    ProjectDetailResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.storage import storage_service

router = APIRouter()


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = GetDB):
    project = Project(
        name=body.name,
        product_title=body.product_title,
        product_description=body.product_description,
    )
    db.add(project)
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
            selectinload(Project.edges),
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
    await db.execute(text("DELETE FROM workflow_edge WHERE project_id = :pid"), {"pid": project_id})
    await db.execute(text("DELETE FROM workflow_node WHERE project_id = :pid"), {"pid": project_id})
    await db.execute(text("DELETE FROM workflow_run WHERE project_id = :pid"), {"pid": project_id})
    await db.execute(text("DELETE FROM project WHERE id = :pid"), {"pid": project_id})
    await db.commit()
    return {"deleted": True}
