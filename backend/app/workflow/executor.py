import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import async_session_factory
from app.core.websocket_manager import websocket_manager
from app.models.project import Project, WorkflowNode, WorkflowRun
import app.workflow.nodes  # noqa: F401 - registers all node handlers
from app.services.ai.model_registry import reload_registry
from app.services.service_container import service_container
from app.workflow.context import WorkflowContext
from app.workflow.pipeline import PIPELINE
from app.workflow.registry import registry

logger = logging.getLogger(__name__)


class WorkflowExecutor:
    def __init__(self, project_id: int, from_node_index: int = 0, celery_task_id: str | None = None):
        self.project_id = project_id
        self.from_node_index = from_node_index
        self.celery_task_id = celery_task_id

    async def execute(self) -> int:
        async with async_session_factory() as db:
            # The Celery worker is a separate process from the FastAPI app
            # so its lifespan hook never ran. Pull the latest registry
            # snapshot here and drop cached AI clients so admin-edited
            # keys take effect on the very next run.
            await reload_registry(db)
            service_container.invalidate()

            result = await db.execute(select(Project).where(Project.id == self.project_id))
            project = result.scalar_one_or_none()
            if not project:
                raise ValueError(f"Project {self.project_id} not found")

            if self.celery_task_id:
                run_result = await db.execute(
                    select(WorkflowRun).where(
                        WorkflowRun.project_id == project.id,
                        WorkflowRun.celery_task_id == self.celery_task_id,
                    )
                )
                run = run_result.scalar_one_or_none()
                if run:
                    run.status = "running"
                    run.started_at = datetime.now(timezone.utc)
                else:
                    run = WorkflowRun(
                        project_id=project.id,
                        status="running",
                        celery_task_id=self.celery_task_id,
                        started_at=datetime.now(timezone.utc),
                    )
                    db.add(run)
            else:
                run = WorkflowRun(
                    project_id=project.id,
                    status="running",
                    started_at=datetime.now(timezone.utc),
                )
                db.add(run)
            await db.commit()
            await db.refresh(run)

            if self.from_node_index > 0:
                reset_result = await db.execute(
                    select(WorkflowNode).where(
                        WorkflowNode.project_id == project.id,
                        WorkflowNode.node_index >= self.from_node_index,
                    )
                )
                for node in reset_result.scalars():
                    node.status = "pending"
                    node.output_json = None
                    node.error_message = None
                    node.debug_log = None
                    node.started_at = None
                    node.completed_at = None
                await db.commit()

            try:
                for idx, pipeline_node in enumerate(PIPELINE):
                    if idx < self.from_node_index:
                        continue

                    await db.refresh(project)
                    if project.status == "cancelled":
                        logger.info(f"Project {project.id} cancelled, aborting workflow")
                        run.status = "cancelled"
                        run.completed_at = datetime.now(timezone.utc)
                        await db.commit()
                        return run.id

                    node_result = await db.execute(
                        select(WorkflowNode).where(
                            WorkflowNode.project_id == project.id,
                            WorkflowNode.node_type == pipeline_node.node_type,
                        )
                    )
                    node = node_result.scalar_one_or_none()
                    if not node:
                        continue

                    node.status = "running"
                    node.started_at = datetime.now(timezone.utc)
                    node.error_message = None
                    await db.commit()

                    await self._broadcast_status(db, node)

                    try:
                        handler = registry.get_handler(node.node_type)
                        if not handler:
                            raise ValueError(f"No handler for {node.node_type}")

                        prior = await self._get_prior_outputs(db, project.id, node.node_index)
                        context = WorkflowContext(
                            project=project,
                            current_node=node,
                            prior_outputs=prior,
                            services=service_container,
                        )

                        output = await handler.execute(context)
                        node.output_json = output
                        node.status = "completed"
                        node.completed_at = datetime.now(timezone.utc)
                        await db.commit()

                        await self._broadcast_status(db, node)

                    except Exception as e:
                        logger.exception(f"Node {node.node_type} failed: {e}")
                        node.status = "failed"
                        node.error_message = str(e)
                        node.completed_at = datetime.now(timezone.utc)
                        await db.commit()

                        await self._broadcast_status(db, node)

                        project.status = "failed"
                        run.status = "failed"
                        run.completed_at = datetime.now(timezone.utc)
                        await db.commit()
                        return run.id

                project.status = "completed"
                run.status = "completed"
                run.completed_at = datetime.now(timezone.utc)
                await db.commit()

            except Exception as e:
                logger.exception(f"Workflow execution failed: {e}")
                await db.refresh(project)
                if project.status != "cancelled":
                    project.status = "failed"
                    run.status = "failed"
                else:
                    run.status = "cancelled"
                run.completed_at = datetime.now(timezone.utc)
                await db.commit()

            return run.id

    async def _get_prior_outputs(self, db, project_id: int, node_index: int) -> dict[str, dict]:
        result = await db.execute(
            select(WorkflowNode).where(
                WorkflowNode.project_id == project_id,
                WorkflowNode.node_index < node_index,
                WorkflowNode.status == "completed",
            ).order_by(WorkflowNode.node_index)
        )
        return {n.node_type: n.output_json for n in result.scalars() if n.output_json}

    async def _broadcast_status(self, db, node: WorkflowNode):
        try:
            await websocket_manager.broadcast(
                node.project_id,
                {
                    "type": "node_status",
                    "data": {
                        "node_id": node.id,
                        "node_type": node.node_type,
                        "node_index": node.node_index,
                        "status": node.status,
                        "output_json": node.output_json,
                        "error_message": node.error_message,
                        "debug_log": node.debug_log,
                    },
                },
            )
        except Exception:
            pass

    @staticmethod
    def pipeline_index(node_type: str) -> int:
        for i, pn in enumerate(PIPELINE):
            if pn.node_type == node_type:
                return i
        return -1
