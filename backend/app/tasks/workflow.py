from app.core.celery_app import celery_app
from app.workflow.executor import NodeExecutor


@celery_app.task(bind=True, name="run_node")
def run_node(self, project_id: int, node_id: int):
    import asyncio

    async def _run():
        executor = NodeExecutor(project_id, node_id, celery_task_id=self.request.id)
        return await executor.execute()

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run())
    finally:
        loop.close()
