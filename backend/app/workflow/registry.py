class NodeHandlerRegistry:
    def __init__(self):
        self._handlers: dict[str, "BaseNodeHandler"] = {}

    def register(self, handler: "BaseNodeHandler"):
        self._handlers[handler.node_type] = handler

    def get_handler(self, node_type: str) -> "BaseNodeHandler | None":
        return self._handlers.get(node_type)

    def get_all_types(self) -> list[str]:
        return list(self._handlers.keys())


registry = NodeHandlerRegistry()
