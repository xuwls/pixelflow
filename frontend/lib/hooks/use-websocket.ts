"use client";

import { useEffect, useRef } from "react";
import { useWorkflowStore } from "@/lib/store/workflow-store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

export function useWebSocket(projectId: number | null) {
  const updateNode = useWorkflowStore((s) => s.updateNode);
  const setRunStatus = useWorkflowStore((s) => s.setRunStatus);
  const setRunning = useWorkflowStore((s) => s.setRunning);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!projectId) return;

    function connect() {
      const ws = new WebSocket(`${WS_URL}/project/${projectId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);

        ws.onclose = () => {
          clearInterval(pingInterval);
          setTimeout(connect, 3000);
        };
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "node_status" && msg.data) {
          const d = msg.data;
          updateNode(d.node_id, {
            status: d.status,
            output_json: d.output_json as Record<string, unknown>,
            error_message: d.error_message,
            debug_log: (d.debug_log as Record<string, unknown> | null) ?? null,
          });
          if (d.status === "running") {
            setRunning(true);
          }
        } else if (msg.type === "run_status" && msg.data) {
          setRunStatus(
            msg.data.status === "completed"
              ? "completed"
              : msg.data.status === "failed"
                ? "failed"
                : "running"
          );
          if (msg.data.status === "completed" || msg.data.status === "failed") {
            setRunning(false);
          }
        } else if (msg.type === "workflow_cancelled") {
          setRunStatus("cancelled");
          setRunning(false);
        } else if (msg.type === "pong") {
          // heartbeat response
        }
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, [projectId, updateNode, setRunStatus, setRunning]);
}
