import type { Project, CreateProjectInput } from "@/lib/types/project";
import type { WorkflowNode, MediaFile, WorkflowStatus } from "@/lib/types/workflow";
import { apiFetch, apiUpload } from "./client";

export function listProjects(page = 1, size = 20): Promise<Project[]> {
  return apiFetch(`/projects?page=${page}&size=${size}`);
}

export function getProject(id: number): Promise<Project & { nodes: WorkflowNode[]; media_files: MediaFile[] }> {
  return apiFetch(`/projects/${id}`);
}

export function createProject(input: CreateProjectInput): Promise<Project> {
  return apiFetch("/projects", { method: "POST", body: JSON.stringify(input) });
}

export function deleteProject(id: number): Promise<{ deleted: boolean }> {
  return apiFetch(`/projects/${id}`, { method: "DELETE" });
}

export function uploadProductImage(projectId: number, file: File): Promise<MediaFile> {
  const fd = new FormData();
  fd.append("file", file);
  return apiUpload(`/projects/${projectId}/upload`, fd);
}
