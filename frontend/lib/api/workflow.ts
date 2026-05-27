import { apiFetch, apiUpload } from "./client";
import type { NodeKind, WorkflowNode, WorkflowEdge, MediaFile } from "@/lib/types/workflow";

export interface CreateNodeInput {
  kind: NodeKind;
  title?: string;
  position_x: number;
  position_y: number;
  prompt?: string;
  config_json?: Record<string, unknown>;
  output_json?: Record<string, unknown>;
}

export interface UpdateNodeInput {
  title?: string;
  position_x?: number;
  position_y?: number;
  prompt?: string;
  config_json?: Record<string, unknown>;
  output_json?: Record<string, unknown>;
}

export function createNode(projectId: number, input: CreateNodeInput): Promise<WorkflowNode> {
  return apiFetch(`/projects/${projectId}/nodes`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchNode(projectId: number, nodeId: number, input: UpdateNodeInput): Promise<WorkflowNode> {
  return apiFetch(`/projects/${projectId}/nodes/${nodeId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteNode(projectId: number, nodeId: number): Promise<{ deleted: boolean }> {
  return apiFetch(`/projects/${projectId}/nodes/${nodeId}`, { method: "DELETE" });
}

export function bulkUpdatePositions(
  projectId: number,
  positions: Array<{ id: number; position_x: number; position_y: number }>,
): Promise<WorkflowNode[]> {
  return apiFetch(`/projects/${projectId}/nodes/positions`, {
    method: "PUT",
    body: JSON.stringify({ positions }),
  });
}

export function uploadNodeAsset(projectId: number, nodeId: number, file: File): Promise<WorkflowNode> {
  const fd = new FormData();
  fd.append("file", file);
  return apiUpload(`/projects/${projectId}/nodes/${nodeId}/upload`, fd);
}

export function createEdge(
  projectId: number,
  sourceNodeId: number,
  targetNodeId: number,
): Promise<WorkflowEdge> {
  return apiFetch(`/projects/${projectId}/edges`, {
    method: "POST",
    body: JSON.stringify({
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
    }),
  });
}

export function deleteEdge(projectId: number, edgeId: number): Promise<{ deleted: boolean }> {
  return apiFetch(`/projects/${projectId}/edges/${edgeId}`, { method: "DELETE" });
}

export function runNode(projectId: number, nodeId: number): Promise<{ run_id: string; status: string }> {
  return apiFetch(`/projects/${projectId}/nodes/${nodeId}/run`, { method: "POST" });
}

export function cancelAllWorkflows(): Promise<{ cancelled_count: number }> {
  return apiFetch("/projects/stop-all-workflows", { method: "POST" });
}

export function getNodeAsset(projectId: number, nodeId: number): Promise<MediaFile> {
  return apiFetch(`/projects/${projectId}/nodes/${nodeId}/asset`);
}

export interface PasteNodeResult {
  node: WorkflowNode;
  media: MediaFile | null;
}

export function pasteNodeAsset(
  projectId: number,
  file: File,
  positionX: number,
  positionY: number,
): Promise<PasteNodeResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("position_x", String(positionX));
  fd.append("position_y", String(positionY));
  return apiUpload(`/projects/${projectId}/nodes/paste`, fd);
}
