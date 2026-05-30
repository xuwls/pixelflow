export type Capability = "文字编辑/生成" | "图片编辑/生成" | "视频编辑/生成";

export interface ModelEntry {
  capability: Capability;
  provider: string;
  model_name: string;
  display_name: string;
  is_default: boolean;
  default_params: Record<string, unknown>;
  param_constraints: {
    supported_sizes?: number[][];
    supported_resolutions?: number[];
    duration_range?: [number, number];
  };
  description: string;
}

export interface ModelListResponse {
  capability: Capability | null;
  models: ModelEntry[];
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "文字编辑/生成": "文字编辑/生成",
  "图片编辑/生成": "图片编辑/生成",
  "视频编辑/生成": "视频编辑/生成",
};

// Free-form node kind → which AI capability to call when generating.
export type NodeKind = "text" | "image" | "video";

export const KIND_TO_CAPABILITY: Record<NodeKind, Capability> = {
  text: "文字编辑/生成",
  image: "图片编辑/生成",
  video: "视频编辑/生成",
};

export const KIND_LABELS: Record<NodeKind, string> = {
  text: "文本",
  image: "图片",
  video: "视频",
};
