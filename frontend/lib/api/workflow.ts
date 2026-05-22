import { apiFetch } from "./client";

export function triggerWorkflow(projectId: number): Promise<{ run_id: string; status: string }> {
  return apiFetch(`/projects/${projectId}/workflow/run`, { method: "POST" });
}

export function getWorkflowStatus(projectId: number): Promise<{ project_status: string; nodes: Array<Record<string, unknown>> }> {
  return apiFetch(`/projects/${projectId}/workflow/status`);
}

export function getNodeDetail(projectId: number, nodeId: number): Promise<Record<string, unknown>> {
  return apiFetch(`/projects/${projectId}/workflow/nodes/${nodeId}`);
}

export function updateNodeConfig(projectId: number, nodeId: number, config: Record<string, unknown>): Promise<Record<string, unknown>> {
  return apiFetch(`/projects/${projectId}/workflow/nodes/${nodeId}/config`, {
    method: "PUT",
    body: JSON.stringify({ config_json: config }),
  });
}

export function retryNode(projectId: number, nodeId: number): Promise<{ run_id: string; status: string }> {
  return apiFetch(`/projects/${projectId}/workflow/nodes/${nodeId}/retry`, { method: "POST" });
}

export function cancelAllWorkflows(): Promise<{ cancelled_count: number }> {
  return apiFetch("/projects/stop-all-workflows", { method: "POST" });
}
