from collections import defaultdict

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, project_id: int, ws: WebSocket):
        await ws.accept()
        self._connections[project_id].add(ws)

    async def disconnect(self, project_id: int, ws: WebSocket):
        self._connections[project_id].discard(ws)
        if not self._connections[project_id]:
            del self._connections[project_id]

    async def broadcast(self, project_id: int, message: dict):
        dead = set()
        for ws in self._connections.get(project_id, set()):
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        self._connections[project_id] -= dead


websocket_manager = WebSocketManager()
