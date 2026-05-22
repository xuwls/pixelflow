import { create } from "zustand";
import type { WorkflowNode } from "@/lib/types/workflow";

interface WorkflowStore {
  nodes: WorkflowNode[];
  selectedNodeId: number | null;
  isRunning: boolean;
  runStatus: "idle" | "running" | "completed" | "failed" | "cancelled";

  setNodes: (nodes: WorkflowNode[]) => void;
  selectNode: (nodeId: number | null) => void;
  updateNode: (nodeId: number, updates: Partial<WorkflowNode>) => void;
  setRunning: (running: boolean) => void;
  setRunStatus: (status: "idle" | "running" | "completed" | "failed" | "cancelled") => void;
  reset: () => void;
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  nodes: [],
  selectedNodeId: null,
  isRunning: false,
  runStatus: "idle",

  setNodes: (nodes) => set({ nodes }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  updateNode: (nodeId, updates) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, ...updates } : n
      ),
    })),
  setRunning: (running) => set({ isRunning: running }),
  setRunStatus: (status) => set({ runStatus: status }),
  reset: () =>
    set({
      nodes: [],
      selectedNodeId: null,
      isRunning: false,
      runStatus: "idle",
    }),
}));
