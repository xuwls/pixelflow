import asyncio

from app.workflow.context import WorkflowContext
from app.workflow.nodes.base import BaseNodeHandler


class ProductInputHandler(BaseNodeHandler):
    node_type = "product_input"
    node_label = "Product Input"

    async def execute(self, context: WorkflowContext) -> dict:
        await asyncio.sleep(0.3)
        return {
            "product_name": context.project.product_title or "Untitled Product",
            "images": [context.project.cover_url] if context.project.cover_url else [],
            "description": context.project.product_description or "",
        }
