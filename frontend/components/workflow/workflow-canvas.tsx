"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Node as RFNode,
  type Edge as RFEdge,
  type Connection,
  type OnSelectionChangeParams,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CustomNode, type CustomNodeData } from "./custom-node";
import { CanvasMenu, type MenuItem } from "./canvas-menu";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { KIND_LABELS, type NodeKind } from "@/lib/types/capability";
import type { WorkflowNode } from "@/lib/types/workflow";
import * as workflowApi from "@/lib/api/workflow";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, Video, Trash2, Play, Merge, Plus, Settings } from "lucide-react";
import { NodeEditDialog } from "./node-edit-dialog";

const NODE_TYPES = { custom: CustomNode };
const DELETE_KEY_CODE: string[] = ["Delete", "Backspace"];

// ── helpers ──────────────────────────────────────────────────────────

function toRfNode(n: WorkflowNode): RFNode<CustomNodeData> {
  return {
    id: String(n.id),
    type: "custom",
    position: { x: n.position_x, y: n.position_y },
    data: {
      kind: n.kind,
      title: n.title,
      prompt: n.prompt,
      status: n.status,
      output_json: n.output_json,
      error_message: n.error_message,
    },
  };
}

function toRfEdge(e: { id: number; source_node_id: number; target_node_id: number }, nodes: WorkflowNode[]): RFEdge {
  const src = nodes.find((n) => n.id === e.source_node_id);
  return {
    id: String(e.id),
    source: String(e.source_node_id),
    target: String(e.target_node_id),
    animated: src?.status === "running",
    style: { stroke: "var(--border)", strokeWidth: 1.5 },
  };
}

// ── menu state types ─────────────────────────────────────────────────

interface PaneMenuState { type: "pane"; screenX: number; screenY: number; flowX: number; flowY: number; }
interface NodeMenuState { type: "node"; screenX: number; screenY: number; nodeId: number; }
interface SelectionMenuState { type: "selection"; screenX: number; screenY: number; nodeIds: number[]; }
type MenuState = PaneMenuState | NodeMenuState | SelectionMenuState | null;

// ── component ────────────────────────────────────────────────────────

interface WorkflowCanvasProps {
  projectId: number;
  initialNodes: WorkflowNode[];
  initialEdges: { id: number; source_node_id: number; target_node_id: number }[];
}

export const WorkflowCanvas = memo(function WorkflowCanvas({ projectId, initialNodes, initialEdges }: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner projectId={projectId} initialNodes={initialNodes} initialEdges={initialEdges} />
    </ReactFlowProvider>
  );
});

const CanvasInner = memo(function CanvasInner({ projectId, initialNodes, initialEdges }: WorkflowCanvasProps) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(
    initialNodes.map((n) => toRfNode(n))
  );
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(
    initialEdges.map((e) => toRfEdge(e, initialNodes))
  );

  const { screenToFlowPosition } = useReactFlow();

  // Zustand mutations — keep in sync for config panels
  const upsertNode = useWorkflowStore((s) => s.upsertNode);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const upsertEdge = useWorkflowStore((s) => s.upsertEdge);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);

  // ── handlers ───────────────────────────────────────────────────────

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === "remove" && typeof c.id === "string") {
          const id = Number(c.id);
          removeNode(id);
          workflowApi.deleteNode(projectId, id).catch(() => {});
        }
      }
      onNodesChange(changes);
    },
    [onNodesChange, projectId, removeNode],
  );

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: RFNode) => {
      workflowApi.bulkUpdatePositions(projectId, [{
        id: Number(node.id),
        position_x: node.position.x,
        position_y: node.position.y,
      }]).catch(() => {});
    },
    [projectId],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const c of changes) {
        if (c.type === "remove" && typeof c.id === "string") {
          const id = Number(c.id);
          removeEdge(id);
          workflowApi.deleteEdge(projectId, id).catch(() => {});
        }
      }
      onEdgesChange(changes);
    },
    [onEdgesChange, projectId, removeEdge],
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const src = Number(connection.source);
      const tgt = Number(connection.target);
      if (src === tgt) return;
      try {
        const edge = await workflowApi.createEdge(projectId, src, tgt);
        upsertEdge(edge);
        setRfEdges((prev) => [...prev, toRfEdge(edge, [])]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "连接失败");
      }
    },
    [projectId, upsertEdge, setRfEdges],
  );

  // ── node creation ──────────────────────────────────────────────────
  const createNodeAt = useCallback(
    async (kind: NodeKind, flowX: number, flowY: number, sourceId?: number) => {
      try {
        const node = await workflowApi.createNode(projectId, {
          kind,
          position_x: Number.isFinite(flowX) ? flowX : 0,
          position_y: Number.isFinite(flowY) ? flowY : 0,
        });
        upsertNode(node);
        setRfNodes((prev) => [...prev, toRfNode(node)]);
        if (sourceId) {
          try {
            const edge = await workflowApi.createEdge(projectId, sourceId, node.id);
            upsertEdge(edge);
            setRfEdges((prev) => [...prev, toRfEdge(edge, [])]);
          } catch {
            // ignore
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "创建节点失败");
      }
    },
    [projectId, setRfNodes, setRfEdges],
  );

  const createMergeNode = useCallback(
    async (kind: NodeKind, sourceIds: number[]) => {
      const sources = sourceIds
        .map((id) => rfNodes.find((n) => Number(n.id) === id))
        .filter(Boolean) as RFNode<CustomNodeData>[];
      if (sources.length === 0) return;
      const maxX = Math.max(...sources.map((n) => n.position.x));
      const avgY = sources.reduce((acc, n) => acc + n.position.y, 0) / sources.length;
      try {
        const node = await workflowApi.createNode(projectId, {
          kind,
          position_x: maxX + 320,
          position_y: avgY,
        });
        upsertNode(node);
        setRfNodes((prev) => [...prev, toRfNode(node)]);
        for (const src of sources) {
          try {
            const edge = await workflowApi.createEdge(projectId, Number(src.id), node.id);
            upsertEdge(edge);
            setRfEdges((prev) => [...prev, toRfEdge(edge, [])]);
          } catch { /* ignore */ }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "合并失败");
      }
    },
    [projectId, rfNodes, setRfNodes, setRfEdges],
  );

  // ── clipboard paste ────────────────────────────────────────────────
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = wrapperRef.current;
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.type.startsWith("image/") && !item.type.startsWith("video/")) continue;
        const blob = item.getAsFile();
        if (!blob) continue;
        e.preventDefault();
        const rect = el?.getBoundingClientRect();
        if (!rect) return;
        const flowPos = screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
        const ext = blob.type.split("/")[1] || "png";
        const file = new File([blob], `paste-${Date.now()}.${ext}`, { type: blob.type });
        try {
          const result = await workflowApi.pasteNodeAsset(projectId, file, flowPos.x, flowPos.y);
          upsertNode(result.node);
          setRfNodes((prev) => [...prev, toRfNode(result.node)]);
          toast.success(`已粘贴${result.node.kind === "image" ? "图片" : "视频"}素材`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "粘贴失败");
        }
        break;
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [projectId, screenToFlowPosition, setRfNodes]);

  // ── UI state ───────────────────────────────────────────────────────
  const [menu, setMenu] = useState<MenuState>(null);
  const [editNodeId, setEditNodeId] = useState<number | null>(null);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: RFNode) => {
    setEditNodeId(Number(node.id));
  }, []);

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      const flow = screenToFlowPosition({
        x: (event as MouseEvent).clientX,
        y: (event as MouseEvent).clientY,
      });
      setMenu({
        type: "pane",
        screenX: (event as MouseEvent).clientX,
        screenY: (event as MouseEvent).clientY,
        flowX: flow.x,
        flowY: flow.y,
      });
    },
    [screenToFlowPosition],
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: RFNode) => {
      event.preventDefault();
      setMenu({ type: "node", screenX: event.clientX, screenY: event.clientY, nodeId: Number(node.id) });
    },
    [],
  );

  // ── menu building ──────────────────────────────────────────────────
  const buildKindItems = (onPick: (k: NodeKind) => void): MenuItem[] => [
    { key: "text", label: KIND_LABELS.text, icon: <FileText className="w-3.5 h-3.5" />, onSelect: () => onPick("text") },
    { key: "image", label: KIND_LABELS.image, icon: <ImageIcon className="w-3.5 h-3.5" />, onSelect: () => onPick("image") },
    { key: "video", label: KIND_LABELS.video, icon: <Video className="w-3.5 h-3.5" />, onSelect: () => onPick("video") },
  ];

  const menuItems: MenuItem[] = useMemo(() => {
    if (!menu) return [];
    if (menu.type === "pane") {
      return [{ key: "create", label: "新建节点", icon: <Plus className="w-3.5 h-3.5" />, children: buildKindItems((k) => createNodeAt(k, menu.flowX, menu.flowY)) }];
    }
    if (menu.type === "node") {
      const node = rfNodes.find((n) => Number(n.id) === menu.nodeId);
      if (!node) return [];
      const canRun = Boolean(node.data.prompt && node.data.prompt.trim());
      return [
        { key: "continue", label: "继续 · 自动连线", icon: <Plus className="w-3.5 h-3.5" />, children: buildKindItems((k) => createNodeAt(k, node.position.x + 320, node.position.y, menu.nodeId)) },
        { key: "edit", label: "编辑", icon: <Settings className="w-3.5 h-3.5" />, onSelect: () => setEditNodeId(menu.nodeId) },
        { key: "run", label: "运行此节点", icon: <Play className="w-3.5 h-3.5" />, disabled: !canRun || node.data.status === "running", onSelect: async () => {
          try { await workflowApi.runNode(projectId, menu.nodeId); toast.success("已开始运行"); } catch (err) { toast.error(err instanceof Error ? err.message : "运行失败"); }
        }},
        { key: "delete", label: "删除节点", icon: <Trash2 className="w-3.5 h-3.5" />, destructive: true, onSelect: async () => {
          try { await workflowApi.deleteNode(projectId, menu.nodeId); removeNode(menu.nodeId); setRfNodes((prev) => prev.filter((n) => Number(n.id) !== menu.nodeId)); } catch { toast.error("删除失败"); }
        }},
      ];
    }
    return [];
  }, [menu, rfNodes, projectId, setRfNodes, createNodeAt]);

  return (
    <div ref={wrapperRef} className="absolute inset-0">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={handleNodesChange}
        onNodeDragStop={handleNodeDragStop}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        deleteKeyCode={DELETE_KEY_CODE}
        proOptions={{ hideAttribution: true }}
        colorMode="light"
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="oklch(0.18 0.01 270 / 0.12)" />
        <Controls showInteractive={false} />
      </ReactFlow>
      {menu && <CanvasMenu x={menu.screenX} y={menu.screenY} items={menuItems} onClose={() => setMenu(null)} />}
      <NodeEditDialog
        open={editNodeId !== null}
        onClose={() => setEditNodeId(null)}
        projectId={projectId}
        node={editNodeId !== null ? (useWorkflowStore.getState().nodes.find((n: WorkflowNode) => n.id === editNodeId) ?? null) : null}
      />
    </div>
  );
});
