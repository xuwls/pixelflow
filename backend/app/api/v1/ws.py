from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.websocket_manager import websocket_manager

router = APIRouter()


@router.websocket("/project/{project_id}")
async def project_websocket(ws: WebSocket, project_id: int):
    await websocket_manager.connect(project_id, ws)
    try:
        while True:
            data = await ws.receive_json()
            if data.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await websocket_manager.disconnect(project_id, ws)
