from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import GetDB
from app.models.project import MediaFile, Project
from app.schemas.project import MediaResponse
from app.services.storage import storage_service

router = APIRouter()


@router.get("/{project_id}/media", response_model=list[MediaResponse])
async def list_media(
    project_id: int,
    file_type: str | None = None,
    db: AsyncSession = GetDB,
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    stmt = select(MediaFile).where(MediaFile.project_id == project_id)
    if file_type:
        stmt = stmt.where(MediaFile.file_type == file_type)
    stmt = stmt.order_by(MediaFile.scene_index, MediaFile.created_at)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{project_id}/export")
async def export_video(project_id: int, db: AsyncSession = GetDB):
    result = await db.execute(
        select(MediaFile).where(
            MediaFile.project_id == project_id,
            MediaFile.file_type == "final_video",
        ).order_by(MediaFile.created_at.desc())
    )
    media = result.scalars().first()
    if not media:
        raise HTTPException(status_code=404, detail="Final video not found")

    download_url = await storage_service.get_presigned_url(media.file_url)
    return {"download_url": download_url}


@router.get("/media/{media_id}/download")
async def download_media(media_id: int, db: AsyncSession = GetDB):
    result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    download_url = await storage_service.get_presigned_url(media.file_url)
    return RedirectResponse(url=download_url)
