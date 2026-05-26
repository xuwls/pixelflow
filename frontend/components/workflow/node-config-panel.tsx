"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { listModels } from "@/lib/api/models";
import * as workflowApi from "@/lib/api/workflow";
import {
  KIND_LABELS,
  KIND_TO_CAPABILITY,
  type ModelEntry,
  type NodeKind,
} from "@/lib/types/capability";
import type { WorkflowNode } from "@/lib/types/workflow";
import { toast } from "sonner";
import { MousePointerClick, Play, Upload, Trash2 } from "lucide-react";
import { StatusBadge } from "./status-badge";

const STORAGE_BASE =
  process.env.NEXT_PUBLIC_STORAGE_URL || "http://localhost:9000/pixelflow";

function resolveAssetUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${STORAGE_BASE}/${value.replace(/^\/+/, "")}`;
}

interface ModelsState {
  kind: NodeKind | null;
  models: ModelEntry[];
}

function useModelsForKind(kind: NodeKind | undefined): {
  models: ModelEntry[];
  loading: boolean;
} {
  const [state, setState] = useState<ModelsState>({ kind: null, models: [] });

  useEffect(() => {
    if (!kind) return;
    let cancelled = false;
    const cap = KIND_TO_CAPABILITY[kind];
    listModels(cap)
      .then((res) => {
        if (!cancelled) setState({ kind, models: res.models });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ kind, models: [] });
          toast.error("加载模型列表失败");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return {
    models: state.kind === kind ? state.models : [],
    loading: state.kind !== kind,
  };
}

export function NodeConfigPanel({ projectId }: { projectId: number }) {
  const nodes = useWorkflowStore((s) => s.nodes);
  const selectedNodeIds = useWorkflowStore((s) => s.selectedNodeIds);

  const selectedNodeId = useMemo(() => {
    if (selectedNodeIds.size !== 1) return null;
    return Array.from(selectedNodeIds)[0];
  }, [selectedNodeIds]);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  if (!selectedNode) {
    const multi = selectedNodeIds.size > 1;
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 py-16 text-center gap-3">
        <div className="w-10 h-10 rounded-sm border border-dashed border-border grid place-items-center">
          <MousePointerClick className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
          {multi ? `${selectedNodeIds.size} NODES SELECTED` : "NO NODE SELECTED"}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">
          {multi
            ? "右键多选节点可合并为一个新节点,或批量删除。"
            : "在画布右键空白处新建节点,或选中已有节点查看配置。"}
        </p>
      </div>
    );
  }

  return (
    <NodeEditor
      key={selectedNode.id}
      projectId={projectId}
      node={selectedNode}
    />
  );
}

function NodeEditor({
  projectId,
  node,
}: {
  projectId: number;
  node: WorkflowNode;
}) {
  const upsertNode = useWorkflowStore((s) => s.upsertNode);
  const removeNode = useWorkflowStore((s) => s.removeNode);

  const [draftTitle, setDraftTitle] = useState(node.title ?? "");
  const [draftPrompt, setDraftPrompt] = useState(node.prompt ?? "");
  const [running, setRunning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { models, loading: loadingModels } = useModelsForKind(node.kind);

  const config = (node.config_json ?? {}) as Record<string, unknown>;
  const modelCfg = (config.model ?? {}) as { provider?: string; model_name?: string };
  const selectedModelKey =
    modelCfg.provider && modelCfg.model_name
      ? `${modelCfg.provider}:${modelCfg.model_name}`
      : (() => {
          const def = models.find((m) => m.is_default) ?? models[0];
          return def ? `${def.provider}:${def.model_name}` : "";
        })();

  async function persistConfig(next: Record<string, unknown>) {
    try {
      const updated = await workflowApi.patchNode(projectId, node.id, {
        config_json: next,
      });
      upsertNode(updated);
    } catch {
      toast.error("配置保存失败");
    }
  }

  async function persistField(input: Parameters<typeof workflowApi.patchNode>[2]) {
    try {
      const updated = await workflowApi.patchNode(projectId, node.id, input);
      upsertNode(updated);
    } catch {
      toast.error("保存失败");
    }
  }

  function handleModelChange(value: string) {
    const [provider, model_name] = value.split(":");
    persistConfig({ ...config, model: { provider, model_name } });
  }

  function handleTitleBlur() {
    if (draftTitle === (node.title ?? "")) return;
    persistField({ title: draftTitle });
  }

  function handlePromptBlur() {
    if (draftPrompt === (node.prompt ?? "")) return;
    persistField({ prompt: draftPrompt });
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const updated = await workflowApi.uploadNodeAsset(projectId, node.id, file);
      upsertNode(updated);
      toast.success("上传完成");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "上传失败";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleRun() {
    setRunning(true);
    try {
      await workflowApi.runNode(projectId, node.id);
      toast.success("已开始运行");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "运行失败";
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }

  async function handleDelete() {
    try {
      await workflowApi.deleteNode(projectId, node.id);
      removeNode(node.id);
    } catch {
      toast.error("删除失败");
    }
  }

  const hasPrompt = Boolean(draftPrompt.trim());
  const hasOutput = Boolean(node.output_json);
  const previewUrl =
    node.kind !== "text" && node.output_json
      ? resolveAssetUrl(
          (node.output_json as Record<string, unknown>).url ??
            (
              (node.output_json as Record<string, unknown>)[
                node.kind === "image" ? "images" : "videos"
              ] as Array<{ url?: string }> | undefined
            )?.[0]?.url,
        )
      : null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-border bg-secondary/30">
        <div className="flex items-baseline justify-between mb-2">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-signal">
            INSPECTOR · 检视
          </p>
          <StatusBadge status={node.status} />
        </div>
        <p className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
          {KIND_LABELS[node.kind]} · #{node.id}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <Section title="标题" caption="TITLE">
          <Input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="给节点起个名字 (可选)"
            className="bg-background border-border"
          />
        </Section>

        <Section title="模型" caption="MODEL">
          {loadingModels ? (
            <div className="h-9 rounded-md border border-border bg-background flex items-center px-3 text-xs text-muted-foreground">
              加载中…
            </div>
          ) : models.length === 0 ? (
            <div className="h-9 rounded-md border border-dashed border-border bg-background flex items-center px-3 text-xs text-muted-foreground">
              此能力下暂无模型,请到 Admin 配置
            </div>
          ) : (
            <Select
              value={selectedModelKey}
              onValueChange={(v) => v && handleModelChange(v)}
            >
              <SelectTrigger className="bg-background border-border w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
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
        </Section>

        <Section title="Prompt" caption="USER PROMPT">
          <Textarea
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            onBlur={handlePromptBlur}
            rows={6}
            placeholder="留空表示这是上传素材节点;填写后点击「运行」生成。"
            className="bg-background border-border font-mono text-[12px] leading-relaxed resize-none"
          />
        </Section>

        <Section title="素材" caption="ASSET">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={
              node.kind === "image"
                ? "image/*"
                : node.kind === "video"
                  ? "video/*"
                  : ".txt,.md,.json"
            }
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full font-mono text-xs tracking-wider gap-2 border-border"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "上传中…" : "上传文件"}
          </Button>

          {previewUrl && node.kind === "image" && (
            <div className="mt-3 rounded-sm border border-border overflow-hidden bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="w-full h-auto" />
            </div>
          )}
          {previewUrl && node.kind === "video" && (
            <div className="mt-3 rounded-sm border border-border overflow-hidden bg-black">
              <video src={previewUrl} className="w-full h-auto" controls preload="metadata" />
            </div>
          )}
        </Section>

        {hasOutput && (
          <Section title="输出" caption="OUTPUT">
            <pre className="p-2.5 bg-background border border-border rounded-sm font-mono text-[10.5px] leading-relaxed text-foreground/80 overflow-x-auto max-h-72 whitespace-pre-wrap break-all">
              {JSON.stringify(node.output_json, null, 2)}
            </pre>
          </Section>
        )}

        {node.error_message && (
          <Section title="错误信息" caption="ERROR" tone="error">
            <pre className="p-2.5 bg-destructive/10 border border-destructive/40 rounded-sm font-mono text-[10.5px] leading-relaxed text-destructive overflow-x-auto whitespace-pre-wrap break-all">
              {node.error_message}
            </pre>
          </Section>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border bg-secondary/30 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          onClick={handleRun}
          disabled={running || !hasPrompt || node.status === "running"}
          className="bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs tracking-wider gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          {node.status === "running" ? "运行中" : "运行"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          className="font-mono text-xs tracking-wider gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除
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
        <Label className="text-[10px] font-mono tracking-[0.25em] uppercase text-muted-foreground">
          {caption} · {title}
        </Label>
        <span
          className={`h-px flex-1 ${tone === "error" ? "bg-destructive/40" : "bg-border"}`}
        />
      </header>
      <div>{children}</div>
    </section>
  );
}
