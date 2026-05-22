export type Capability = "vl" | "llm" | "t2i" | "i2i" | "i2v" | "t2v" | "tts";

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

// node → primary capability(写死,与后端 NODE_CAPABILITY 保持一致)
// 第一个是默认 capability;有多 capability 的节点(keyframe/video_generation)在
// UI 里显示能力切换器。
export const NODE_CAPABILITIES: Record<string, Capability[]> = {
  product_understanding: ["vl"],
  selling_point: ["llm"],
  script: ["llm"],
  storyboard: ["llm"],
  prompt: ["llm"],
  keyframe: ["t2i", "i2i"],
  video_generation: ["i2v", "t2v"],
  voiceover: ["tts"],
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
  vl: "VL · 图生文",
  llm: "LLM · 文生文",
  t2i: "T2I · 文生图",
  i2i: "I2I · 图生图",
  t2v: "T2V · 文生视频",
  i2v: "I2V · 图生视频",
  tts: "TTS · 语音合成",
};
