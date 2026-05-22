from abc import ABC, abstractmethod

from app.workflow.context import WorkflowContext


class BaseNodeHandler(ABC):
    node_type: str
    node_label: str

    @abstractmethod
    async def execute(self, context: WorkflowContext) -> dict:
        ...

    async def validate_input(self, context: WorkflowContext) -> bool:
        return True
