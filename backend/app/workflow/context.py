from dataclasses import dataclass, field

from app.models.project import Project


@dataclass
class WorkflowContext:
    project: Project
    current_node: "WorkflowNode | None" = None
    prior_outputs: dict[str, dict] = field(default_factory=dict)
    services: "ServiceContainer | None" = None

    def get_output(self, node_type: str) -> dict | None:
        return self.prior_outputs.get(node_type)

    def get_all_text_content(self) -> str:
        parts = []
        for nt, output in self.prior_outputs.items():
            parts.append(f"## {nt}")
            parts.append(str(output))
        return "\n".join(parts)
