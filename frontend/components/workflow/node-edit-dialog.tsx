"use client";

import { useEffect, useRef, useState } from "react";
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
  KIND_TO_CAPABILITY,
  type ModelEntry,
  type NodeKind,
} from "@/lib/types/capability";
import type { WorkflowNode } from "@/lib/types/workflow";
import { toast } from "sonner";
import { Play, Upload, Trash2, ChevronDown, Image as ImageIcon, Video } from "lucide-react";

const STORAGE_BASE =
  process.env.NEXT_PUBLIC_STORAGE_URL || "http://localhost:9000/pixelflow";

function resolveAssetUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${STORAGE_BASE}/${value.replace(/^\/+/, "")}`;
}

// ── presets ────────────────────────────────────────────────────

interface AspectPreset { label: string; w: number; h: number; }
const ASPECT_RATIOS: AspectPreset[] = [
  { label: "16:9", w: 16, h: 9 },
  { label: "1:1", w: 1, h: 1 },
  { label: "9:16", w: 9, h: 16 },
];

const IMAGE_RESOLUTIONS = [1024, 1536, 2048];
const VIDEO_RESOLUTIONS = [720, 1080];

function computeDims(aspectW: number, aspectH: number, baseRes: number) {
  if (aspectW > aspectH) return { w: Math.round(baseRes * aspectW / aspectH), h: baseRes };
  if (aspectH > aspectW) return { w: baseRes, h: Math.round(baseRes * aspectH / aspectW) };
  return { w: baseRes, h: baseRes };
}

// ── mode tabs ─────────────────────────────────────────────────

type EditMode = "image" | "video";

const MODE_TABS: { key: EditMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "image", label: "生图", icon: ImageIcon },
  { key: "video", label: "生视频", icon: Video },
];

// ── model hook ────────────────────────────────────────────────

function useModels(kind: NodeKind) {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listModels(KIND_TO_CAPABILITY[kind])
      .then((res) => { if (!cancelled) { setModels(res.models); setLoading(false); } })
      .catch(() => { if (!cancelled) { setModels([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [kind]);

  return { models, loading };
}

// ── inline panel ──────────────────────────────────────────────

interface NodeEditDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  node: WorkflowNode | null;
}

export function NodeEditDialog({ open, onClose, projectId, node }: NodeEditDialogProps) {
  if (!node || !open) return null;
  return (
    <>
      <div className="absolute inset-0 z-40" onClick={onClose} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[520px] max-h-[85vh] overflow-hidden flex flex-col rounded-2xl bg-[#1c1c20] border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
        <NodeEditContent projectId={projectId} node={node} onDelete={onClose} />
      </div>
    </>
  );
}

// ── content ──────────────────────────────────────────────────

function NodeEditContent({ projectId, node, onDelete }: { projectId: number; node: WorkflowNode; onDelete: () => void }) {
  const upsertNode = useWorkflowStore((s) => s.upsertNode);
  const removeNode = useWorkflowStore((s) => s.removeNode);

  const [draftPrompt, setDraftPrompt] = useState(node.prompt ?? "");
  const [running, setRunning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // mode: 根据 node.kind 初始化，可切换
  const [mode, setMode] = useState<EditMode>(node.kind === "video" ? "video" : "image");

  // 切换 mode 时重新加载模型
  const modeKind: NodeKind = mode === "video" ? "video" : "image";
  const { models, loading: loadingModels } = useModels(modeKind);

  const config = (node.config_json ?? {}) as Record<string, unknown>;
  const modelCfg = (config.model ?? {}) as { provider?: string; model_name?: string; display_name?: string };
  const width = (config.width as number) ?? 1024;
  const height = (config.height as number) ?? 1024;
  const durationSec = (config.duration_sec as number) ?? 5;

  const selectedModelKey = modelCfg.provider && modelCfg.model_name
    ? `${modelCfg.provider}:${modelCfg.model_name}`
    : (() => { const def = models.find((m) => m.is_default) ?? models[0]; return def ? `${def.provider}:${def.model_name}` : ""; })();

  const curShortSide = Math.min(width, height);
  const curAspectKey = (() => { const r = width / height; if (r > 1.6) return "16:9"; if (r < 0.6) return "9:16"; return "1:1"; })();
  const resolutions = mode === "video" ? VIDEO_RESOLUTIONS : IMAGE_RESOLUTIONS;

  // ── persist ──────────────────────────────────────────────────
  async function persistConfig(next: Record<string, unknown>) {
    try { const u = await workflowApi.patchNode(projectId, node.id, { config_json: next }); upsertNode(u); } catch { toast.error("保存失败"); }
  }
  async function persistField(input: Parameters<typeof workflowApi.patchNode>[2]) {
    try { const u = await workflowApi.patchNode(projectId, node.id, input); upsertNode(u); } catch { toast.error("保存失败"); }
  }

  // ── handlers ─────────────────────────────────────────────────
  function handleModeChange(newMode: EditMode) {
    setMode(newMode);
    // 切换模式时重置分辨率为默认值
    const defaultRes = newMode === "video" ? 720 : 1024;
    const { w, h } = computeDims(ASPECT_RATIOS[0].w, ASPECT_RATIOS[0].h, defaultRes);
    persistConfig({ ...config, width: w, height: h });
  }

  function handleModelChange(v: string | null) {
    if (!v) return;
    const [provider, model_name] = v.split(":");
    const m = models.find((x) => x.provider === provider && x.model_name === model_name);
    persistConfig({ ...config, model: { provider, model_name, display_name: m?.display_name } });
  }

  function handleAspect(aspect: AspectPreset) {
    const { w, h } = computeDims(aspect.w, aspect.h, curShortSide || 1024);
    persistConfig({ ...config, width: w, height: h });
  }

  function handleResolution(res: number) {
    const cur = ASPECT_RATIOS.find((a) => a.label === curAspectKey) ?? ASPECT_RATIOS[0];
    const { w, h } = computeDims(cur.w, cur.h, res);
    persistConfig({ ...config, width: w, height: h });
  }

  function handleDurationChange(val: number) { persistConfig({ ...config, duration_sec: val }); }
  function handlePromptBlur() { if (draftPrompt !== (node.prompt ?? "")) persistField({ prompt: draftPrompt }); }

  async function handleUpload(file: File) {
    setUploading(true);
    try { const u = await workflowApi.uploadNodeAsset(projectId, node.id, file); upsertNode(u); toast.success("上传完成"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "上传失败"); }
    finally { setUploading(false); }
  }
  async function handleRun() {
    setRunning(true);
    try { await workflowApi.runNode(projectId, node.id); toast.success("已开始运行"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "运行失败"); }
    finally { setRunning(false); }
  }
  async function handleDelete() {
    try { await workflowApi.deleteNode(projectId, node.id); removeNode(node.id); onDelete(); }
    catch { toast.error("删除失败"); }
  }

  const previewUrl = node.kind !== "text" && node.output_json
    ? resolveAssetUrl((node.output_json as Record<string, unknown>).url ??
        ((node.output_json as Record<string, unknown>)[node.kind === "image" ? "images" : "videos"] as Array<{ url?: string }> | undefined)?.[0]?.url)
    : null;

  const hasPrompt = Boolean(draftPrompt.trim());

  return (
    <>
      {/* ── 顶部 Tab 栏：生图 / 生视频 ────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-1 bg-white/8 rounded-xl p-1">
          {MODE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.key;
            return (
              <button key={tab.key} onClick={() => handleModeChange(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                  active ? "bg-white/15 text-white" : "text-white/50 hover:text-white/70"
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <button onClick={onDelete} className="text-white/40 hover:text-white/70 transition-colors">
          <span className="text-[18px] leading-none">×</span>
        </button>
      </div>

      {/* ── 素材引用区 ────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <input ref={fileInputRef} type="file" className="hidden"
          accept={mode === "image" ? "image/*" : "video/*"}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); if (fileInputRef.current) fileInputRef.current.value = ""; }}
        />
        <div className="flex items-center gap-3">
          {previewUrl ? (
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/15 shrink-0 group">
              {node.kind === "image" ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <video src={previewUrl} className="w-full h-full object-cover" preload="metadata" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Upload className="w-3 h-3 text-white" />
              </div>
            </button>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-12 h-12 rounded-lg border border-dashed border-white/20 flex items-center justify-center text-white/40 hover:text-white/60 hover:border-white/35 transition-colors shrink-0">
              <Upload className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            {["标记", "运镜", "角色库"].map((label) => (
              <span key={label} className="px-2 py-0.5 rounded border border-white/12 text-[10px] text-white/60 cursor-default hover:border-white/25 hover:text-white/80 transition-colors">
                {label}
              </span>
            ))}
            {previewUrl && (
              <span className="px-2 py-0.5 rounded bg-white/12 text-[10px] text-white font-medium">
                {mode === "image" ? "图片参考" : "视频参考"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 提示词输入 ────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <textarea
          value={draftPrompt}
          onChange={(e) => setDraftPrompt(e.target.value)}
          onBlur={handlePromptBlur}
          rows={5}
          placeholder="描述你想要生成的画面内容，@引用素材"
          className="w-full bg-white/5 border border-white/10 rounded-lg outline-none text-[13px] text-white placeholder:text-white/35 py-2.5 px-3 resize-none leading-relaxed focus:border-white/20 transition-colors"
        />
      </div>

      {/* ── 底部参数栏 ────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-white/10">
        {/* 模型选择器 */}
        {loadingModels ? (
          <span className="text-[11px] text-white/40">加载中…</span>
        ) : (
          <Select value={selectedModelKey} onValueChange={handleModelChange}>
            <SelectTrigger className="h-7 rounded-lg bg-white/8 border-white/12 text-[11px] text-white hover:bg-white/12 transition-colors w-auto min-w-0 gap-1 px-2">
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent className="bg-[#2a2a2e] border-white/12">
              {models.map((m) => (
                <SelectItem key={`${m.provider}:${m.model_name}`} value={`${m.provider}:${m.model_name}`}
                  className="text-[11px] text-white/80 focus:bg-white/12 focus:text-white">
                  {m.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* 参数摘要：比例 · 分辨率 · 时长 */}
        <div className="flex items-center gap-1 text-[11px] text-white/50">
          <span>{curAspectKey}</span>
          <span className="text-white/20">·</span>
          <span>{width}×{height}</span>
          {mode === "video" && (
            <>
              <span className="text-white/20">·</span>
              <span>{durationSec}s</span>
            </>
          )}
        </div>

        <div className="flex-1" />

        <button onClick={handleDelete}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-white/8 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <button onClick={handleRun} disabled={running || !hasPrompt || node.status === "running"}
          className="h-7 px-3 rounded-lg bg-white text-black text-[11px] font-semibold flex items-center gap-1.5 hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          <Play className="w-3 h-3" />
          {node.status === "running" ? "运行中" : "运行"}
        </button>
      </div>

      {/* ── 展开参数区 ────────────────────────────────────── */}
      <ExpandableParams
        mode={mode}
        curAspectKey={curAspectKey}
        curShortSide={curShortSide}
        durationSec={durationSec}
        resolutions={resolutions}
        onAspect={handleAspect}
        onResolution={handleResolution}
        onDuration={handleDurationChange}
      />
    </>
  );
}

// ── 可展开的参数面板 ──────────────────────────────────────────

function ExpandableParams({
  mode, curAspectKey, curShortSide, durationSec, resolutions,
  onAspect, onResolution, onDuration,
}: {
  mode: EditMode;
  curAspectKey: string;
  curShortSide: number;
  durationSec: number;
  resolutions: number[];
  onAspect: (a: AspectPreset) => void;
  onResolution: (r: number) => void;
  onDuration: (v: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-white/10">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-white/50 hover:text-white/70 transition-colors">
        <span>参数设置</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* 比例 */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 w-8 shrink-0">比例</span>
            <div className="flex items-center gap-1">
              {ASPECT_RATIOS.map((ar) => (
                <button key={ar.label} onClick={() => onAspect(ar)}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                    curAspectKey === ar.label ? "bg-white/18 text-white font-medium" : "text-white/55 hover:text-white/75 hover:bg-white/8"
                  }`}>
                  {ar.label}
                </button>
              ))}
            </div>
          </div>
          {/* 分辨率（实际数值） */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 w-8 shrink-0">分辨率</span>
            <div className="flex items-center gap-1">
              {resolutions.map((res) => (
                <button key={res} onClick={() => onResolution(res)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                    curShortSide === res ? "bg-white/18 text-white font-medium" : "text-white/55 hover:text-white/75 hover:bg-white/8"
                  }`}>
                  {res}
                </button>
              ))}
            </div>
          </div>
          {/* 时长（仅视频） */}
          {mode === "video" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 w-8 shrink-0">时长</span>
              <input type="range" min={1} max={15} step={1} value={durationSec}
                onChange={(e) => onDuration(Number(e.target.value))}
                className="flex-1 h-1 rounded-full appearance-none bg-white/12 cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
              <span className="text-[11px] text-white/65 font-mono w-6 text-right">{durationSec}s</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
