"use client";

import { useEffect, useRef } from "react";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import type { NodeStatus } from "@/lib/types/workflow";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

export function useWebSocket(projectId: number | null) {
  const patchNode = useWorkflowStore((s) => s.patchNode);
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
          if (typeof d.node_id === "number") {
            patchNode(d.node_id, {
              status: d.status as NodeStatus,
              output_json: (d.output_json as Record<string, unknown> | null) ?? null,
              error_message: (d.error_message as string | null) ?? null,
            });
          }
        }
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, [projectId, patchNode]);
}
