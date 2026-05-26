from fastapi import APIRouter

from app.api.v1 import admin, graph, media, models, projects, workflow

router = APIRouter()
router.include_router(projects.router, prefix="/projects", tags=["projects"])
router.include_router(graph.router, prefix="/projects", tags=["graph"])
router.include_router(workflow.router, prefix="/projects", tags=["workflow"])
router.include_router(media.router, prefix="/projects", tags=["media"])
router.include_router(models.router, tags=["models"])
router.include_router(admin.router, prefix="/admin", tags=["admin"])
