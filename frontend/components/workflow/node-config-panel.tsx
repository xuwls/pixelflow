"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { updateNodeConfig, retryNode } from "@/lib/api/workflow";
import { listModels } from "@/lib/api/models";
import {
  CAPABILITY_LABELS,
  NODE_CAPABILITIES,
  PROMPT_EDITABLE_NODES,
  type Capability,
  type ModelEntry,
} from "@/lib/types/capability";
import { toast } from "sonner";
import { RefreshCw, MousePointerClick } from "lucide-react";
import { DebugSection } from "./debug-section";
import { PromptEditor } from "./prompt-editor";
import { useUIStore } from "@/lib/store/ui-store";
import { StatusBadge } from "./status-badge";

const NODE_LABELS: Record<string, string> = {
  product_input: "商品输入",
  product_understanding: "商品理解",
  selling_point: "卖点生成",
  script: "脚本生成",
  storyboard: "分镜生成",
  prompt: "提示词生成",
  keyframe: "关键帧生成",
  video_generation: "视频生成",
  subtitle: "字幕生成",
  voiceover: "配音生成",
  video_composition: "视频合成",
};

interface NodeModelConfig {
  capability?: Capability;
  provider?: string;
  model_name?: string;
  temperature?: number;
}

function readModelConfig(config: Record<string, unknown> | null | undefined): NodeModelConfig {
  const raw = (config?.model ?? {}) as Record<string, unknown>;
  return {
    capability: raw.capability as Capability | undefined,
    provider: raw.provider as string | undefined,
    model_name: raw.model_name as string | undefined,
    temperature: raw.temperature as number | undefined,
  };
}

function readUserPrompt(config: Record<string, unknown> | null | undefined): string {
  const value = config?.user_prompt;
  return typeof value === "string" ? value : "";
}

export function NodeConfigPanel({ projectId }: { projectId: number }) {
  const nodes = useWorkflowStore((s) => s.nodes);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const debugMode = useUIStore((s) => s.debugMode);
  const [updating, setUpdating] = useState(false);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // model dropdown state, scoped to the active capability
  const [modelsByCapability, setModelsByCapability] = useState<Record<Capability, ModelEntry[]>>(
    {} as Record<Capability, ModelEntry[]>,
  );
  const [loadingModels, setLoadingModels] = useState(false);

  const supportedCapabilities = selectedNode
    ? NODE_CAPABILITIES[selectedNode.node_type] ?? []
    : [];
  const modelConfig = readModelConfig(selectedNode?.config_json);
  const userPrompt = readUserPrompt(selectedNode?.config_json);
  // Local mirror so typing in the prompt textarea is responsive even before save.
  const [draftPrompt, setDraftPrompt] = useState(userPrompt);

  useEffect(() => {
    setDraftPrompt(userPrompt);
  }, [selectedNodeId, userPrompt]);

  const activeCapability: Capability | undefined =
    modelConfig.capability ?? supportedCapabilities[0];

  // Fetch models for whichever capabilities this node supports.
  useEffect(() => {
    if (supportedCapabilities.length === 0) return;
    let cancelled = false;
    setLoadingModels(true);
    Promise.all(
      supportedCapabilities.map(async (cap) => {
        const res = await listModels(cap);
        return [cap, res.models] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        const next = {} as Record<Capability, ModelEntry[]>;
        for (const [cap, list] of entries) next[cap] = list;
        setModelsByCapability(next);
      })
      .catch(() => {
        if (!cancelled) toast.error("加载模型列表失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
    // re-fetch when the selected node's supported caps change
  }, [supportedCapabilities.join("|")]);

  const activeModels: ModelEntry[] = useMemo(() => {
    if (!activeCapability) return [];
    return modelsByCapability[activeCapability] ?? [];
  }, [activeCapability, modelsByCapability]);

  const selectedModelKey = useMemo(() => {
    if (modelConfig.provider && modelConfig.model_name) {
      return `${modelConfig.provider}:${modelConfig.model_name}`;
    }
    const def = activeModels.find((m) => m.is_default) ?? activeModels[0];
    return def ? `${def.provider}:${def.model_name}` : "";
  }, [modelConfig.provider, modelConfig.model_name, activeModels]);

  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 py-16 text-center gap-3">
        <div className="w-10 h-10 rounded-sm border border-dashed border-border grid place-items-center">
          <MousePointerClick className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
          NO NODE SELECTED
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">
          点击左侧或中央画布上的任意节点,
          <br />
          查看配置与输出。
        </p>
      </div>
    );
  }

  const config = selectedNode.config_json || {};
  const nodeLabel = NODE_LABELS[selectedNode.node_type] || selectedNode.node_type;
  const promptEditable = PROMPT_EDITABLE_NODES.has(selectedNode.node_type);
  const hasModelPicker = supportedCapabilities.length > 0;

  async function persistConfig(nextConfig: Record<string, unknown>) {
    if (!selectedNode) return;
    try {
      await updateNodeConfig(projectId, selectedNode.id, nextConfig);
    } catch {
      toast.error("配置保存失败");
    }
  }

  function handleCapabilityChange(nextCap: Capability) {
    const list = modelsByCapability[nextCap] ?? [];
    const def = list.find((m) => m.is_default) ?? list[0];
    persistConfig({
      ...config,
      model: {
        capability: nextCap,
        provider: def?.provider,
        model_name: def?.model_name,
      },
    });
  }

  function handleModelChange(value: string) {
    const [provider, model_name] = value.split(":");
    persistConfig({
      ...config,
      model: {
        ...(modelConfig as Record<string, unknown>),
        capability: activeCapability,
        provider,
        model_name,
      },
    });
  }

  function handlePromptSave() {
    if (draftPrompt === userPrompt) return;
    const next = { ...config };
    if (draftPrompt.trim()) {
      next.user_prompt = draftPrompt;
    } else {
      delete next.user_prompt;
    }
    persistConfig(next);
  }

  async function handleRetry() {
    if (!selectedNode) return;
    setUpdating(true);
    try {
      await retryNode(projectId, selectedNode.id);
      toast.success("节点重跑已开始");
    } catch {
      toast.error("重跑失败");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-border bg-secondary/30">
        <div className="flex items-baseline justify-between mb-2">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-signal">
            INSPECTOR / 检视
          </p>
          <StatusBadge status={selectedNode.status} />
        </div>
        <h3
          className="text-lg leading-tight"
          style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
        >
          {nodeLabel}
        </h3>
        <p className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground mt-0.5">
          {selectedNode.node_type}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {hasModelPicker ? (
          <Section title="模型配置" caption="MODEL">
            {supportedCapabilities.length > 1 && (
              <div className="space-y-2">
                <Label className="text-[11px] font-mono tracking-wider uppercase text-muted-foreground">
                  能力 · CAPABILITY
                </Label>
                <Select
                  value={activeCapability ?? supportedCapabilities[0]}
                  onValueChange={(v) => {
                    if (v) handleCapabilityChange(v as Capability);
                  }}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedCapabilities.map((cap) => (
                      <SelectItem key={cap} value={cap}>
                        {CAPABILITY_LABELS[cap]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[11px] font-mono tracking-wider uppercase text-muted-foreground">
                模型 · MODEL
                {activeCapability && supportedCapabilities.length === 1 && (
                  <span className="ml-2 text-[10px] normal-case tracking-normal text-muted-foreground/70">
                    {CAPABILITY_LABELS[activeCapability]}
                  </span>
                )}
              </Label>
              {loadingModels ? (
                <div className="h-9 rounded-md border border-border bg-background flex items-center px-3 text-xs text-muted-foreground">
                  加载中…
                </div>
              ) : activeModels.length === 0 ? (
                <div className="h-9 rounded-md border border-dashed border-border bg-background flex items-center px-3 text-xs text-muted-foreground">
                  当前能力下暂无可用模型
                </div>
              ) : (
                <Select
                  value={selectedModelKey}
                  onValueChange={(v) => {
                    if (v) handleModelChange(v);
                  }}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeModels.map((m) => (
                      <SelectItem
                        key={`${m.provider}:${m.model_name}`}
                        value={`${m.provider}:${m.model_name}`}
                      >
                        <span className="flex flex-col">
                          <span>{m.display_name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {m.provider} / {m.model_name}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </Section>
        ) : (
          <Section title="模型配置" caption="MODEL">
            <p className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
              此节点不需要模型(由 FFmpeg/系统逻辑处理)
            </p>
          </Section>
        )}

        {promptEditable && (
          <Section title="Prompt" caption="USER PROMPT">
            <PromptEditor
              projectId={projectId}
              nodeId={selectedNode.id}
              value={draftPrompt}
              onChange={setDraftPrompt}
              onSave={handlePromptSave}
              defaultPlaceholder="留空使用默认 Prompt 模板。手动编辑或点击「一键生成」自动改写。"
            />
          </Section>
        )}

        {debugMode && selectedNode.debug_log && (
          <DebugSection debugLog={selectedNode.debug_log} />
        )}

        {selectedNode.output_json && (
          <Section title="节点输出" caption="OUTPUT">
            <pre className="p-2.5 bg-background border border-border rounded-sm font-mono text-[10.5px] leading-relaxed text-foreground/80 overflow-x-auto max-h-72 whitespace-pre-wrap break-all">
              {JSON.stringify(selectedNode.output_json, null, 2)}
            </pre>
          </Section>
        )}

        {selectedNode.error_message && (
          <Section title="错误信息" caption="ERROR" tone="error">
            <pre className="p-2.5 bg-destructive/10 border border-destructive/40 rounded-sm font-mono text-[10.5px] leading-relaxed text-destructive overflow-x-auto whitespace-pre-wrap break-all">
              {selectedNode.error_message}
            </pre>
          </Section>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border bg-secondary/30">
        <Button
          variant="outline"
          size="sm"
          className="w-full font-mono text-xs tracking-wider gap-2 border-border"
          onClick={handleRetry}
          disabled={updating || selectedNode.status === "running"}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          从此处重跑 · RETRY
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  caption,
  tone,
  children,
}: {
  title: string;
  caption: string;
  tone?: "error";
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <header className="flex items-baseline gap-2">
        <span className="h-px flex-1 bg-border" />
        <span
          className={`font-mono text-[10px] tracking-[0.25em] uppercase ${
            tone === "error" ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {caption} · {title}
        </span>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
