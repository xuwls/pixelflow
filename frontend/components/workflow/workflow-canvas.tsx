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
import { FileText, Image as ImageIcon, Video, Trash2, Play, Plus, Settings } from "lucide-react";
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
type MenuState = PaneMenuState | NodeMenuState | null;

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

  // One-time sync from Zustand if canvas initialized before data arrived
  const graphLoaded = useWorkflowStore((s) => s.graphLoaded);
  const didSync = useRef(false);
  useEffect(() => {
    if (graphLoaded && !didSync.current && rfNodes.length === 0) {
      const store = useWorkflowStore.getState();
      setRfNodes(store.nodes.map((n) => toRfNode(n)));
      setRfEdges(store.edges.map((e) => toRfEdge(e, store.nodes)));
      didSync.current = true;
    }
  }, [graphLoaded, rfNodes.length, setRfNodes, setRfEdges]);

  // ── handlers ───────────────────────────────────────────────────────

  const handleNodesChange = useCallback(
    (changes: NodeChange<RFNode<CustomNodeData>>[]) => {
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
    (changes: EdgeChange<RFEdge>[]) => {
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
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const pendingSourceRef = useRef<number[]>([]);
  const pendingPosRef = useRef<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  // ── box-select kind picker ─────────────────────────────────────────
  const [boxPicker, setBoxPicker] = useState<{ screenX: number; screenY: number } | null>(null);

  // ── right-click drag box-select ────────────────────────────────────
  const [rbSelecting, setRbSelecting] = useState(false);
  const [rbRect, setRbRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const rbStart = useRef<{ sx: number; sy: number } | null>(null);
  const rbMoved = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 2) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    rbStart.current = { sx: e.clientX, sy: e.clientY };
    rbMoved.current = false;
    setRbSelecting(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!rbSelecting || !rbStart.current) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x1 = rbStart.current.sx;
    const y1 = rbStart.current.sy;
    const x2 = e.clientX;
    const y2 = e.clientY;
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    if (dx > 3 || dy > 3) rbMoved.current = true;
    setRbRect({
      x: Math.min(x1, x2) - rect.left,
      y: Math.min(y1, y2) - rect.top,
      w: dx,
      h: dy,
    });
  }, [rbSelecting]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button !== 2 || !rbSelecting) return;
    const savedStart = rbStart.current; // capture before nullifying
    setRbSelecting(false);
    setRbRect(null);
    rbStart.current = null;

    if (!rbMoved.current) return; // single right-click, let context menu handle it

    // compute which nodes are inside the selection rect
    const f1 = screenToFlowPosition({ x: Math.min(e.clientX, savedStart?.sx ?? e.clientX), y: Math.min(e.clientY, savedStart?.sy ?? e.clientY) });
    const f2 = screenToFlowPosition({ x: Math.max(e.clientX, savedStart?.sx ?? e.clientX), y: Math.max(e.clientY, savedStart?.sy ?? e.clientY) });
    const inside = rfNodes.filter((n) => {
      const nw = n.measured?.width ?? 240;
      const nh = n.measured?.height ?? 100;
      return n.position.x + nw >= f1.x && n.position.x <= f2.x && n.position.y + nh >= f1.y && n.position.y <= f2.y;
    });
    if (inside.length > 0) {
      const ids = inside.map((n) => Number(n.id));
      pendingSourceRef.current = ids;
      setSelectedNodeIds(ids);
      setRfNodes((prev) => prev.map((n) => ({ ...n, selected: ids.includes(Number(n.id)) })));
      // 弹出简易 kind 选择器（坐标相对于画布容器）
      const wrapRect = wrapperRef.current?.getBoundingClientRect();
      if (wrapRect) {
        setBoxPicker({ screenX: e.clientX - wrapRect.left, screenY: e.clientY - wrapRect.top });
      }
    }
    e.preventDefault();
  }, [rbSelecting, screenToFlowPosition, rfNodes, setRfNodes]);

  // left click = select only (preview, no edit)
  const handleNodeClick = useCallback((_event: React.MouseEvent, _node: RFNode) => {
    // selection handled by ReactFlow natively
  }, []);

  // keep track of selected nodes (for Ctrl+click etc)
  const handleSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const ids = params.nodes.map((n) => Number(n.id));
    setSelectedNodeIds(ids);
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

  const menuItems: MenuItem[] = useMemo(() => {
    if (!menu) return [];
    if (menu.type === "pane") {
      return [{
        key: "create", label: "新建节点", icon: <Plus className="w-3.5 h-3.5" />,
        onSelect: () => {
          // 用简易 kind 选择器代替 PendingNodeDialog
          pendingSourceRef.current = [];
          setSelectedNodeIds([]);
          setBoxPicker({ screenX: menu.screenX - (wrapperRef.current?.getBoundingClientRect().left ?? 0), screenY: menu.screenY - (wrapperRef.current?.getBoundingClientRect().top ?? 0) });
          // 记住点击位置用于创建节点
          pendingPosRef.current = { x: menu.flowX, y: menu.flowY };
        },
      }];
    }
    if (menu.type === "node") {
      const node = rfNodes.find((n) => Number(n.id) === menu.nodeId);
      if (!node) return [];
      const canRun = Boolean(node.data.prompt && node.data.prompt.trim());
      return [
        { key: "continue", label: "继续 · 自动连线", icon: <Plus className="w-3.5 h-3.5" />, onSelect: () => {
          // 用简易 kind 选择器，记住源节点和位置
          setSelectedNodeIds([menu.nodeId]);
          pendingSourceRef.current = [menu.nodeId];
          pendingPosRef.current = { x: node.position.x + 320, y: node.position.y };
          setBoxPicker({
            screenX: (wrapperRef.current?.getBoundingClientRect().left ?? 0) + node.position.x + 320,
            screenY: (wrapperRef.current?.getBoundingClientRect().top ?? 0) + node.position.y,
          });
        } },
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
    <div
      ref={wrapperRef}
      className="absolute inset-0"
      onContextMenu={(e) => { if (rbMoved.current) { e.preventDefault(); rbMoved.current = false; } }}
    >
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
        onSelectionChange={handleSelectionChange}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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
      {menu && <CanvasMenu x={menu.screenX} y={menu.screenY} items={menuItems} onClose={closeMenu} />}

      {/* right-click drag selection rectangle */}
      {rbRect && (
        <div
          className="absolute z-40 pointer-events-none border border-signal/60 bg-signal/8 rounded-sm"
          style={{ left: rbRect.x, top: rbRect.y, width: rbRect.w, height: rbRect.h }}
        />
      )}

      <NodeEditDialog
        open={editNodeId !== null}
        onClose={() => setEditNodeId(null)}
        projectId={projectId}
        node={editNodeId !== null ? (useWorkflowStore.getState().nodes.find((n: WorkflowNode) => n.id === editNodeId) ?? null) : null}
      />

      {/* ── kind picker（右键新建 + 框选共用）───────────────── */}
      {boxPicker && (
        <>
          <div className="absolute inset-0 z-40" onClick={() => { setBoxPicker(null); pendingSourceRef.current = []; setSelectedNodeIds([]); }} />
          <div
            className="absolute z-50 flex items-center gap-1 bg-[#1c1c20] border border-white/10 rounded-xl p-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
            style={{ left: boxPicker.screenX, top: boxPicker.screenY }}
          >
            {([
              { kind: "text" as NodeKind, icon: FileText, label: "文本" },
              { kind: "image" as NodeKind, icon: ImageIcon, label: "图片" },
              { kind: "video" as NodeKind, icon: Video, label: "视频" },
            ]).map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.kind}
                  onClick={async () => {
                    const sourceIds = pendingSourceRef.current;
                    const clickPos = pendingPosRef.current;
                    setBoxPicker(null);
                    pendingPosRef.current = null;
                    try {
                      // 计算位置：有选中节点则放右侧，否则用右键位置
                      let posX: number;
                      let posY: number;
                      if (sourceIds.length > 0) {
                        const sources = sourceIds.map((id) => rfNodes.find((n) => Number(n.id) === id)).filter(Boolean);
                        posX = Math.max(...sources.map((n) => n!.position.x)) + 320;
                        posY = sources.reduce((a, n) => a + n!.position.y, 0) / sources.length;
                      } else if (clickPos) {
                        posX = clickPos.x;
                        posY = clickPos.y;
                      } else {
                        posX = 0; posY = 0;
                      }
                      const node = await workflowApi.createNode(projectId, {
                        kind: opt.kind,
                        position_x: posX,
                        position_y: posY,
                      });
                      upsertNode(node);
                      setRfNodes((prev) => [...prev, toRfNode(node)]);
                      // 自动连线
                      for (const srcId of sourceIds) {
                        try {
                          const edge = await workflowApi.createEdge(projectId, srcId, node.id);
                          upsertEdge(edge);
                          setRfEdges((prev) => [...prev, toRfEdge(edge, [])]);
                        } catch { /* ignore */ }
                      }
                      toast.success(`已创建${KIND_LABELS[opt.kind]}节点`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "创建失败");
                    }
                    pendingSourceRef.current = [];
                    setSelectedNodeIds([]);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] text-white/70 hover:bg-white/12 hover:text-white transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});
