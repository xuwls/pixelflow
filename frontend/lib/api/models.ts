import { apiFetch } from "./client";
import type {
  Capability,
  ModelListResponse,
  NodeCapabilityResponse,
} from "@/lib/types/capability";

export function listModels(capability?: Capability): Promise<ModelListResponse> {
  const qs = capability ? `?capability=${capability}` : "";
  return apiFetch(`/models${qs}`);
}

export function listNodeCapabilities(): Promise<NodeCapabilityResponse[]> {
  return apiFetch(`/node-capabilities`);
}

export interface GeneratePromptResponse {
  user_prompt: string;
  based_on: string;
}

export function generatePrompt(
  projectId: number,
  nodeId: number,
  body: { extra_instruction?: string; capability?: Capability } = {},
): Promise<GeneratePromptResponse> {
  return apiFetch(
    `/projects/${projectId}/workflow/nodes/${nodeId}/generate-prompt`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
