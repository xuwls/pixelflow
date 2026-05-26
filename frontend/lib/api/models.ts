import { apiFetch } from "./client";
import type { Capability, ModelListResponse } from "@/lib/types/capability";

export function listModels(capability?: Capability): Promise<ModelListResponse> {
  const qs = capability ? `?capability=${encodeURIComponent(capability)}` : "";
  return apiFetch(`/models${qs}`);
}
