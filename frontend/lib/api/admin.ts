import { apiFetch } from "./client";
import type {
  ModelCreate,
  ModelResponse,
  ModelUpdate,
  ProviderCreate,
  ProviderResponse,
  ProviderUpdate,
} from "@/lib/types/admin";

export function listProviders(): Promise<ProviderResponse[]> {
  return apiFetch(`/admin/providers`);
}

export function createProvider(payload: ProviderCreate): Promise<ProviderResponse> {
  return apiFetch(`/admin/providers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProvider(
  id: number,
  payload: ProviderUpdate,
): Promise<ProviderResponse> {
  return apiFetch(`/admin/providers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProvider(id: number): Promise<void> {
  const url = `/api/v1/admin/providers/${id}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Delete failed");
  }
}

export function listAdminModels(): Promise<ModelResponse[]> {
  return apiFetch(`/admin/models`);
}

export function createAdminModel(payload: ModelCreate): Promise<ModelResponse> {
  return apiFetch(`/admin/models`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminModel(
  id: number,
  payload: ModelUpdate,
): Promise<ModelResponse> {
  return apiFetch(`/admin/models/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminModel(id: number): Promise<void> {
  return apiFetch(`/admin/models/${id}`, { method: "DELETE" });
}
