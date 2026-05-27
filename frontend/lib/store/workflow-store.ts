import { create } from "zustand";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types/workflow";

interface WorkflowStore {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeIds: Set<number>;
  graphLoaded: boolean;
  initialSyncDone: boolean;

  setGraph: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  markInitialSyncDone: () => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;

  upsertNode: (node: WorkflowNode) => void;
  removeNode: (nodeId: number) => void;
  patchNode: (nodeId: number, updates: Partial<WorkflowNode>) => void;

  upsertEdge: (edge: WorkflowEdge) => void;
  removeEdge: (edgeId: number) => void;

  selectOnly: (nodeId: number) => void;
  toggleSelect: (nodeId: number) => void;
  setSelection: (ids: Iterable<number>) => void;
  clearSelection: () => void;

  reset: () => void;
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeIds: new Set<number>(),
  graphLoaded: false,
  initialSyncDone: false,

  setGraph: (nodes, edges) => set({ nodes, edges, graphLoaded: true }),
  markInitialSyncDone: () => set({ initialSyncDone: true }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  upsertNode: (node) =>
    set((s) => {
      const idx = s.nodes.findIndex((n) => n.id === node.id);
      if (idx >= 0) {
        const next = s.nodes.slice();
        next[idx] = node;
        return { nodes: next };
      }
      return { nodes: [...s.nodes, node] };
    }),

  removeNode: (nodeId) =>
    set((s) => {
      const nextSel = new Set(s.selectedNodeIds);
      nextSel.delete(nodeId);
      return {
        nodes: s.nodes.filter((n) => n.id !== nodeId),
        edges: s.edges.filter((e) => e.source_node_id !== nodeId && e.target_node_id !== nodeId),
        selectedNodeIds: nextSel,
      };
    }),

  patchNode: (nodeId, updates) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
    })),

  upsertEdge: (edge) =>
    set((s) => {
      if (s.edges.some((e) => e.id === edge.id)) return s;
      return { edges: [...s.edges, edge] };
    }),

  removeEdge: (edgeId) => set((s) => ({ edges: s.edges.filter((e) => e.id !== edgeId) })),

  selectOnly: (nodeId) => set({ selectedNodeIds: new Set([nodeId]) }),
  toggleSelect: (nodeId) =>
    set((s) => {
      const next = new Set(s.selectedNodeIds);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return { selectedNodeIds: next };
    }),
  setSelection: (ids) => set({ selectedNodeIds: new Set(ids) }),
  clearSelection: () => set({ selectedNodeIds: new Set() }),

  reset: () => set({ nodes: [], edges: [], selectedNodeIds: new Set(), graphLoaded: false, initialSyncDone: false }),
}));
