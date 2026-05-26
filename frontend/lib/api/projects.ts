import type { Project, CreateProjectInput } from "@/lib/types/project";
import type { WorkflowNode, WorkflowEdge, MediaFile } from "@/lib/types/workflow";
import { apiFetch } from "./client";

export function listProjects(page = 1, size = 20): Promise<Project[]> {
  return apiFetch(`/projects?page=${page}&size=${size}`);
}

export function getProject(id: number): Promise<
  Project & { nodes: WorkflowNode[]; edges: WorkflowEdge[]; media_files: MediaFile[] }
> {
  return apiFetch(`/projects/${id}`);
}

export function createProject(input: CreateProjectInput): Promise<Project> {
  return apiFetch("/projects", { method: "POST", body: JSON.stringify(input) });
}

export function deleteProject(id: number): Promise<{ deleted: boolean }> {
  return apiFetch(`/projects/${id}`, { method: "DELETE" });
}
