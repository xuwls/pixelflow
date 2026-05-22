import type { Capability } from "./capability";

export interface ProviderResponse {
  id: number;
  name: string;
  display_name: string;
  api_key_masked: string;
  has_api_key: boolean;
  base_url: string | null;
  enabled: boolean;
  description: string | null;
}

export interface ProviderCreate {
  name: string;
  display_name: string;
  api_key?: string;
  base_url?: string | null;
  enabled?: boolean;
  description?: string | null;
}

export interface ProviderUpdate {
  display_name?: string;
  api_key?: string;
  base_url?: string | null;
  enabled?: boolean;
  description?: string | null;
}

export interface ModelResponse {
  id: number;
  provider_id: number;
  provider_name: string;
  capability: Capability;
  model_name: string;
  display_name: string;
  is_default: boolean;
  default_params: Record<string, unknown>;
  description: string | null;
  enabled: boolean;
  sort_order: number;
}

export interface ModelCreate {
  provider_id: number;
  capability: Capability;
  model_name: string;
  display_name: string;
  is_default?: boolean;
  default_params?: Record<string, unknown>;
  description?: string | null;
  enabled?: boolean;
  sort_order?: number;
}

export interface ModelUpdate {
  capability?: Capability;
  model_name?: string;
  display_name?: string;
  is_default?: boolean;
  default_params?: Record<string, unknown>;
  description?: string | null;
  enabled?: boolean;
  sort_order?: number;
}

export const CAPABILITIES: Capability[] = [
  "vl",
  "llm",
  "t2i",
  "i2i",
  "i2v",
  "t2v",
  "tts",
];
