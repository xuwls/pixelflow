"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { FileText, Image as ImageIcon, Video, Trash2, Play, Merge, Plus } from "lucide-react";

const NODE_TYPES = { custom: CustomNode };
const FIT_VIEW_OPTIONS = { padding: 0.4, maxZoom: 1.1 };
const DELETE_KEY_CODE: string[] = ["Delete", "Backspace"];

// ── helpers ──────────────────────────────────────────────────────────

function toRfNode(n: WorkflowNode, selected: boolean): RFNode<CustomNodeData> {
  return {
    id: String(n.id),
    type: "custom",
    position: { x: n.position_x, y: n.position_y },
    selected,
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

function toRfEdge(
  e: { id: number; source_node_id: number; target_node_id: number },
  nodes: WorkflowNode[],
): RFEdge {
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

interface PaneMenuState {
  type: "pane";
  screenX: number;
  screenY: number;
  flowX: number;
  flowY: number;
}

interface NodeMenuState {
  type: "node";
  screenX: number;
  screenY: number;
  nodeId: number;
}

interface SelectionMenuState {
  type: "selection";
  screenX: number;
  screenY: number;
  nodeIds: number[];
}

type MenuState = PaneMenuState | NodeMenuState | SelectionMenuState | null;

// ── component ────────────────────────────────────────────────────────

export function WorkflowCanvas({ projectId }: { projectId: number }) {
  return (
    <ReactFlowProvider>
      <CanvasInner projectId={projectId} />
    </ReactFlowProvider>
  );
}

function CanvasInner({ projectId }: { projectId: number }) {
  // ── Zustand store (source of truth for persistence) ──────────────
  const storeNodes = useWorkflowStore((s) => s.nodes);
  const storeEdges = useWorkflowStore((s) => s.edges);
  const selectedNodeIds = useWorkflowStore((s) => s.selectedNodeIds);
  const upsertNode = useWorkflowStore((s) => s.upsertNode);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);
  const upsertEdge = useWorkflowStore((s) => s.upsertEdge);
  const setSelection = useWorkflowStore((s) => s.setSelection);
  const setGraph = useWorkflowStore((s) => s.setGraph);

  // ── React Flow's own state (handles rendering, no external loop) ──
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  // Sync Zustand → React Flow whenever store data changes
  const prevStoreLen = useRef(0);
  useEffect(() => {
    const len = storeNodes.length + storeEdges.length;
    if (len > 0 && len !== prevStoreLen.current) {
      (setRfNodes as any)(storeNodes.map((n) => toRfNode(n, selectedNodeIds.has(n.id))));
      (setRfEdges as any)(storeEdges.map((e) => toRfEdge(e, storeNodes)));
      prevStoreLen.current = len;
    }
  }, [storeNodes, storeEdges]);

  // ── selection sync ────────────────────────────────────────────────
  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      const ids = params.nodes.map((n) => Number(n.id));
      const current = useWorkflowStore.getState().selectedNodeIds;
      if (ids.length !== current.size || ids.some((id) => !current.has(id))) {
        setSelection(ids);
      }
    },
    [setSelection],
  );

  // ── position persistence ──────────────────────────────────────────
  const positionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyPositions = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Intercept onNodesChange to track drag positions
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Track position changes for persistence
      for (const c of changes) {
        if (c.type === "position" && typeof c.id === "string" && c.position) {
          dirtyPositions.current.set(Number(c.id), {
            x: c.position.x,
            y: c.position.y,
          });
        }
        if (c.type === "remove" && typeof c.id === "string") {
          const id = Number(c.id);
          removeNode(id);
          workflowApi.deleteNode(projectId, id).catch(() => {});
        }
      }
      // Always pass through to React Flow's internal handler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (onNodesChange as any)(changes);
      // Schedule position flush
      if (dirtyPositions.current.size) {
        if (positionTimer.current) clearTimeout(positionTimer.current);
        positionTimer.current = setTimeout(() => {
          const dirty = dirtyPositions.current;
          if (!dirty.size) return;
          const payload = Array.from(dirty.entries()).map(([id, pos]) => ({
            id,
            position_x: pos.x,
            position_y: pos.y,
          }));
          // Update Zustand
          const store = useWorkflowStore.getState();
          const byId = new Map(store.nodes.map((n) => [n.id, n]));
          for (const p of payload) {
            const n = byId.get(p.id);
            if (n) {
              n.position_x = p.position_x;
              n.position_y = p.position_y;
            }
          }
          store.setNodes(store.nodes.slice());
          dirty.clear();
          // Persist to API (fire-and-forget)
          workflowApi.bulkUpdatePositions(projectId, payload).catch(() => {});
        }, 350);
      }
    },
    [onNodesChange, projectId, removeNode],
  );

  // Intercept onEdgesChange for edge removal persistence
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const c of changes) {
        if (c.type === "remove" && typeof c.id === "string") {
          const id = Number(c.id);
          removeEdge(id);
          workflowApi.deleteEdge(projectId, id).catch(() => {});
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (onEdgesChange as any)(changes);
    },
    [onEdgesChange, projectId, removeEdge],
  );

  // ── other React Flow callbacks ─────────────────────────────────────
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [menu, setMenu] = useState<MenuState>(null);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const src = Number(connection.source);
      const tgt = Number(connection.target);
      if (src === tgt) return;
      try {
        const edge = await workflowApi.createEdge(projectId, src, tgt);
        upsertEdge(edge);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "连接失败";
        toast.error(msg);
      }
    },
    [projectId, upsertEdge],
  );

  // ── node creation ──────────────────────────────────────────────────
  const addNodeToRf = useCallback(
    (node: WorkflowNode) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (setRfNodes as any)((prev: any) => [...prev, toRfNode(node, false)]);
    },
    [setRfNodes],
  );

  const createNodeAt = useCallback(
    async (kind: NodeKind, flowX: number, flowY: number, sourceId?: number) => {
      const x = Number.isFinite(flowX) ? flowX : 0;
      const y = Number.isFinite(flowY) ? flowY : 0;
      try {
        const node = await workflowApi.createNode(projectId, {
          kind,
          position_x: x,
          position_y: y,
        });
        upsertNode(node);
        addNodeToRf(node);
        if (sourceId) {
          try {
            const edge = await workflowApi.createEdge(projectId, sourceId, node.id);
            upsertEdge(edge);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "连接失败";
            toast.error(msg);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "创建节点失败";
        toast.error(msg);
      }
    },
    [projectId, upsertNode, upsertEdge, addNodeToRf],
  );

  const createMergeNode = useCallback(
    async (kind: NodeKind, sourceIds: number[]) => {
      const sources = sourceIds
        .map((id) => storeNodes.find((n) => n.id === id))
        .filter((n): n is WorkflowNode => Boolean(n));
      if (sources.length === 0) return;
      const maxX = Math.max(...sources.map((n) => n.position_x));
      const avgY = sources.reduce((acc, n) => acc + n.position_y, 0) / sources.length;
      const x = maxX + 320;
      const y = avgY;
      try {
        const node = await workflowApi.createNode(projectId, {
          kind,
          position_x: x,
          position_y: y,
        });
        upsertNode(node);
        addNodeToRf(node);
        for (const src of sources) {
          try {
            const edge = await workflowApi.createEdge(projectId, src.id, node.id);
            upsertEdge(edge);
          } catch {
            // ignore individual edge failures
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "合并失败";
        toast.error(msg);
      }
    },
    [projectId, storeNodes, upsertNode, upsertEdge, addNodeToRf],
  );

  // ── context menu handlers ──────────────────────────────────────────
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
      const id = Number(node.id);
      const current = useWorkflowStore.getState().selectedNodeIds;
      if (!current.has(id) || current.size <= 1) {
        setSelection([id]);
        setMenu({ type: "node", screenX: event.clientX, screenY: event.clientY, nodeId: id });
      } else {
        setMenu({
          type: "selection",
          screenX: event.clientX,
          screenY: event.clientY,
          nodeIds: Array.from(current),
        });
      }
    },
    [setSelection],
  );

  const handleSelectionContextMenu = useCallback(
    (event: React.MouseEvent, selectedNodes: RFNode[]) => {
      event.preventDefault();
      setMenu({
        type: "selection",
        screenX: event.clientX,
        screenY: event.clientY,
        nodeIds: selectedNodes.map((n) => Number(n.id)),
      });
    },
    [],
  );

  // ── menu building ──────────────────────────────────────────────────
  const buildKindItems = (onPick: (k: NodeKind) => void): MenuItem[] => [
    {
      key: "text",
      label: KIND_LABELS.text,
      icon: <FileText className="w-3.5 h-3.5" />,
      onSelect: () => onPick("text"),
    },
    {
      key: "image",
      label: KIND_LABELS.image,
      icon: <ImageIcon className="w-3.5 h-3.5" />,
      onSelect: () => onPick("image"),
    },
    {
      key: "video",
      label: KIND_LABELS.video,
      icon: <Video className="w-3.5 h-3.5" />,
      onSelect: () => onPick("video"),
    },
  ];

  const menuItems: MenuItem[] = useMemo(() => {
    if (!menu) return [];

    if (menu.type === "pane") {
      return [
        {
          key: "create",
          label: "新建节点",
          icon: <Plus className="w-3.5 h-3.5" />,
          children: buildKindItems((k) => createNodeAt(k, menu.flowX, menu.flowY)),
        },
      ];
    }

    if (menu.type === "node") {
      const node = storeNodes.find((n) => n.id === menu.nodeId);
      if (!node) return [];
      const continueX = node.position_x + 320;
      const continueY = node.position_y;
      const canRun = Boolean(node.prompt && node.prompt.trim());
      return [
        {
          key: "continue",
          label: "继续 · 自动连线",
          icon: <Plus className="w-3.5 h-3.5" />,
          children: buildKindItems((k) => createNodeAt(k, continueX, continueY, node.id)),
        },
        {
          key: "run",
          label: "运行此节点",
          icon: <Play className="w-3.5 h-3.5" />,
          disabled: !canRun || node.status === "running",
          onSelect: async () => {
            try {
              await workflowApi.runNode(projectId, node.id);
              toast.success("已开始运行");
            } catch (err) {
              const msg = err instanceof Error ? err.message : "运行失败";
              toast.error(msg);
            }
          },
        },
        {
          key: "delete",
          label: "删除节点",
          icon: <Trash2 className="w-3.5 h-3.5" />,
          destructive: true,
          onSelect: async () => {
            try {
              await workflowApi.deleteNode(projectId, node.id);
              removeNode(node.id);
              (setRfNodes as any)((prev: any) => prev.filter((n: any) => n.id !== String(node.id)));
            } catch {
              toast.error("删除失败");
            }
          },
        },
      ];
    }

    return [
      {
        key: "merge",
        label: `合并为新节点 (${menu.nodeIds.length})`,
        icon: <Merge className="w-3.5 h-3.5" />,
        children: buildKindItems((k) => createMergeNode(k, menu.nodeIds)),
      },
      {
        key: "delete-all",
        label: `删除选中 (${menu.nodeIds.length})`,
        icon: <Trash2 className="w-3.5 h-3.5" />,
        destructive: true,
        onSelect: async () => {
          for (const id of menu.nodeIds) {
            try {
              await workflowApi.deleteNode(projectId, id);
              removeNode(id);
            } catch {
              // continue
            }
          }
          (setRfNodes as any)((prev: any) => prev.filter((n: any) => !menu.nodeIds.includes(Number(n.id))));
        },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, storeNodes, projectId]);

  return (
    <div ref={wrapperRef} className="absolute inset-0">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onSelectionContextMenu={handleSelectionContextMenu}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        deleteKeyCode={DELETE_KEY_CODE}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        className="bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="oklch(0.18 0.01 270 / 0.12)"
        />
        <Controls showInteractive={false} />
      </ReactFlow>

      {menu && (
        <CanvasMenu
          x={menu.screenX}
          y={menu.screenY}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
