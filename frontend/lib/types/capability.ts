export type Capability = "文字编辑/生成" | "图片编辑/生成" | "视频编辑/生成";

export interface ModelEntry {
  capability: Capability;
  provider: string;
  model_name: string;
  display_name: string;
  is_default: boolean;
  default_params: Record<string, unknown>;
  description: string;
}

export interface ModelListResponse {
  capability: Capability | null;
  models: ModelEntry[];
}

export interface NodeCapabilityResponse {
  node_type: string;
  capabilities: Capability[];
  default_capability: Capability | null;
}

// node → primary capability (与后端 NODE_CAPABILITY 保持一致)
export const NODE_CAPABILITIES: Record<string, Capability[]> = {
  product_understanding: ["文字编辑/生成"],
  selling_point: ["文字编辑/生成"],
  script: ["文字编辑/生成"],
  storyboard: ["文字编辑/生成"],
  prompt: ["文字编辑/生成"],
  keyframe: ["图片编辑/生成"],
  video_generation: ["视频编辑/生成"],
  voiceover: ["文字编辑/生成"],
};

// 哪些节点支持 user_prompt 自定义 + 一键生成
export const PROMPT_EDITABLE_NODES = new Set([
  "product_understanding",
  "selling_point",
  "script",
  "storyboard",
  "prompt",
]);

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "文字编辑/生成": "文字编辑/生成",
  "图片编辑/生成": "图片编辑/生成",
  "视频编辑/生成": "视频编辑/生成",
};
