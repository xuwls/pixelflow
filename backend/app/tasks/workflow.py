from app.core.celery_app import celery_app
from app.workflow.executor import WorkflowExecutor


@celery_app.task(bind=True, name="run_workflow")
def run_workflow(self, project_id: int, from_node_index: int = 0):
    import asyncio

    async def _run():
        executor = WorkflowExecutor(project_id, from_node_index, celery_task_id=self.request.id)
        return await executor.execute()

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run())
    finally:
        loop.close()
