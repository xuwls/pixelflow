"use client";

import { useEffect, useRef, useState } from "react";
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
import { Play, Upload, Trash2, ChevronDown, Image as ImageIcon, Video, Check } from "lucide-react";

const STORAGE_BASE =
  process.env.NEXT_PUBLIC_STORAGE_URL || "/pixelflow-media";

function resolveAssetUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${STORAGE_BASE}/${value.replace(/^\/+/, "")}`;
}

// ── presets ────────────────────────────────────────────────────

type EditMode = "image" | "video";

const MODE_TABS: { key: EditMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "image", label: "生图", icon: ImageIcon },
  { key: "video", label: "生视频", icon: Video },
];

const ASPECT_OPTIONS = [
  { label: "Auto", w: 0, h: 0 },
  { label: "16:9", w: 16, h: 9 },
  { label: "4:3", w: 4, h: 3 },
  { label: "1:1", w: 1, h: 1 },
  { label: "3:4", w: 3, h: 4 },
  { label: "9:16", w: 9, h: 16 },
  { label: "21:9", w: 21, h: 9 },
];

const IMAGE_RESOLUTIONS = [480, 720, 1024, 1536, 2048];
const VIDEO_RESOLUTIONS = [480, 720, 1080];

function computeDims(aspectW: number, aspectH: number, baseRes: number) {
  if (aspectW === 0 || aspectH === 0) return { w: baseRes, h: baseRes };
  if (aspectW > aspectH) return { w: Math.round(baseRes * aspectW / aspectH), h: baseRes };
  if (aspectH > aspectW) return { w: baseRes, h: Math.round(baseRes * aspectH / aspectW) };
  return { w: baseRes, h: baseRes };
}

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
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[540px] max-h-[85vh] overflow-hidden flex flex-col rounded-2xl bg-[#1c1c20] border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
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

  const [mode, setMode] = useState<EditMode>(node.kind === "video" ? "video" : "image");
  const modeKind: NodeKind = mode === "video" ? "video" : "image";
  const { models, loading: loadingModels } = useModels(modeKind);

  const config = (node.config_json ?? {}) as Record<string, unknown>;
  const modelCfg = (config.model ?? {}) as { provider?: string; model_name?: string; display_name?: string };

  // 本地 state，保证点击参数立即生效
  const [width, setWidth] = useState((config.width as number) ?? 1024);
  const [height, setHeight] = useState((config.height as number) ?? 1024);
  const [durationSec, setDurationSec] = useState((config.duration_sec as number) ?? 5);
  const [soundEffects, setSoundEffects] = useState((config.sound_effects as boolean) ?? false);

  // node prop 变化时同步本地 state
  useEffect(() => {
    const c = (node.config_json ?? {}) as Record<string, unknown>;
    setWidth((c.width as number) ?? 1024);
    setHeight((c.height as number) ?? 1024);
    setDurationSec((c.duration_sec as number) ?? 5);
    setSoundEffects((c.sound_effects as boolean) ?? false);
  }, [node.config_json]);

  const selectedModelKey = modelCfg.provider && modelCfg.model_name
    ? `${modelCfg.provider}:${modelCfg.model_name}`
    : (() => { const def = models.find((m) => m.is_default) ?? models[0]; return def ? `${def.provider}:${def.model_name}` : ""; })();
  const selectedModel = models.find((m) => `${m.provider}:${m.model_name}` === selectedModelKey);

  const curShortSide = Math.min(width, height);
  const curAspectKey = (() => {
    const r = width / height;
    if (Math.abs(r - 1) < 0.05) return "1:1";
    if (Math.abs(r - 16 / 9) < 0.05) return "16:9";
    if (Math.abs(r - 9 / 16) < 0.05) return "9:16";
    if (Math.abs(r - 4 / 3) < 0.05) return "4:3";
    if (Math.abs(r - 3 / 4) < 0.05) return "3:4";
    if (Math.abs(r - 21 / 9) < 0.05) return "21:9";
    return "16:9";
  })();
  const resolutions = mode === "video" ? VIDEO_RESOLUTIONS : IMAGE_RESOLUTIONS;

  // ── 参数约束检查（根据 model_name 推导）──────────────────────
  const constraints = (() => {
    if (!selectedModel) return {};
    const mn = selectedModel.model_name;
    if (mode === "image") {
      if (mn.startsWith("wanx2.1")) return { supported_sizes: [[1024, 1024], [720, 1280], [1280, 720], [768, 1152], [1152, 768]] };
      if (mn.startsWith("wanx")) return { supported_sizes: [[1024, 1024], [720, 1280], [1280, 720]] };
      // 其他图片模型（seedream, nano-banana 等）：支持常见尺寸
      return { supported_sizes: [[1024, 1024], [720, 1280], [1280, 720], [768, 1152], [1152, 768], [1536, 1024], [1024, 1536], [2048, 1024], [1024, 2048]] };
    }
    if (mode === "video") {
      if (mn.startsWith("wan")) return { supported_resolutions: [720, 1080], duration_range: [1, 5] as [number, number] };
      return { supported_resolutions: [720, 1080], duration_range: [1, 10] as [number, number] };
    }
    return {};
  })();

  function isAspectSupported(label: string): boolean {
    if (!constraints.supported_sizes) return true; // 无约束 = 全部支持
    const ar = ASPECT_OPTIONS.find((a) => a.label === label);
    if (!ar || ar.w === 0) return true; // Auto 总是支持
    return constraints.supported_sizes.some(([sw, sh]) => {
      const ratio = sw / sh;
      const targetRatio = ar.w / ar.h;
      return Math.abs(ratio - targetRatio) < 0.05;
    });
  }

  function isResSupported(res: number): boolean {
    if (mode === "video") {
      if (!constraints.supported_resolutions) return true;
      return constraints.supported_resolutions.includes(res);
    }
    // 图片：检查 supported_sizes 中是否有短边为 res 的
    if (!constraints.supported_sizes) return true;
    return constraints.supported_sizes.some(([sw, sh]) => Math.min(sw, sh) === res || Math.max(sw, sh) === res);
  }

  function isDurationSupported(val: number): boolean {
    if (!constraints.duration_range) return true;
    return val >= constraints.duration_range[0] && val <= constraints.duration_range[1];
  }

  // dropdowns
  const [showModelDrop, setShowModelDrop] = useState(false);
  const [showParamDrop, setShowParamDrop] = useState(false);

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
    const defaultRes = newMode === "video" ? 720 : 1024;
    const { w, h } = computeDims(16, 9, defaultRes);
    setWidth(w); setHeight(h);
    persistConfig({ ...config, width: w, height: h });
  }
  function handleModelSelect(m: ModelEntry) {
    persistConfig({ ...config, model: { provider: m.provider, model_name: m.model_name, display_name: m.display_name } });
    setShowModelDrop(false);
  }
  function handleAspectSelect(label: string) {
    const ar = ASPECT_OPTIONS.find((a) => a.label === label);
    if (!ar) return;
    const newShortSide = Math.min(width, height);
    const { w, h } = computeDims(ar.w, ar.h, newShortSide || 1024);
    setWidth(w); setHeight(h);
    persistConfig({ ...config, width: w, height: h });
  }
  function handleResSelect(res: number) {
    const cur = ASPECT_OPTIONS.find((a) => a.label === curAspectKey) ?? ASPECT_OPTIONS[1];
    const { w, h } = computeDims(cur.w, cur.h, res);
    setWidth(w); setHeight(h);
    persistConfig({ ...config, width: w, height: h });
  }
  function handleDurationChange(val: number) {
    setDurationSec(val);
    persistConfig({ ...config, duration_sec: val });
  }
  function handleSoundToggle() {
    const next = !soundEffects;
    setSoundEffects(next);
    persistConfig({ ...config, sound_effects: next });
  }
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
      {/* ── Tab 栏 ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-1 bg-white/8 rounded-xl p-1">
          {MODE_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => handleModeChange(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                  mode === tab.key ? "bg-white/15 text-white" : "text-white/50 hover:text-white/70"
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <button onClick={onDelete} className="text-white/40 hover:text-white/70 transition-colors text-lg">×</button>
      </div>

      {/* ── 素材引用 ──────────────────────────────────────── */}
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

      {/* ── 提示词 ────────────────────────────────────────── */}
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

      {/* ── 底部工具栏 ────────────────────────────────────── */}
      <div className="relative flex items-center gap-2 px-4 py-2.5 border-t border-white/10">
        {/* 模型选择器（点击展开） */}
        <button onClick={() => { setShowModelDrop(!showModelDrop); setShowParamDrop(false); }}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/8 border border-white/12 text-[11px] text-white hover:bg-white/12 transition-colors">
          <span className="font-medium truncate max-w-[140px]">{selectedModel?.display_name ?? "选择模型"}</span>
          <ChevronDown className="w-3 h-3 text-white/50" />
        </button>

        {/* 参数选择器（点击展开） */}
        <button onClick={() => { setShowParamDrop(!showParamDrop); setShowModelDrop(false); }}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/8 border border-white/12 text-[11px] text-white/70 hover:bg-white/12 transition-colors">
          <span>{curAspectKey} · {width}×{height}</span>
          {mode === "video" && <span>· {durationSec}s</span>}
          <ChevronDown className="w-3 h-3 text-white/40" />
        </button>

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

      {/* ── 模型下拉列表 ──────────────────────────────────── */}
      {showModelDrop && (
        <div className="mx-4 mb-2 rounded-xl bg-[#2a2a2e] border border-white/10 overflow-hidden max-h-[240px] overflow-y-auto">
          {loadingModels ? (
            <div className="px-3 py-4 text-center text-[11px] text-white/40">加载中…</div>
          ) : models.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-white/40">无可用模型</div>
          ) : (
            models.map((m) => {
              const key = `${m.provider}:${m.model_name}`;
              const active = key === selectedModelKey;
              return (
                <button key={key} onClick={() => handleModelSelect(m)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    active ? "bg-white/10" : "hover:bg-white/5"
                  }`}>
                  <div className="w-8 h-8 rounded-lg bg-white/8 grid place-items-center shrink-0">
                    <span className="text-[10px] text-white/50 font-mono">{m.provider.slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white font-medium truncate">{m.display_name}</p>
                    {m.description && (
                      <p className="text-[10px] text-white/40 truncate mt-0.5">{m.description}</p>
                    )}
                  </div>
                  {active && <Check className="w-3.5 h-3.5 text-white/60 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* ── 参数下拉面板 ──────────────────────────────────── */}
      {showParamDrop && (
        <div className="mx-4 mb-2 rounded-xl bg-[#2a2a2e] border border-white/10 p-4 space-y-4">
          {/* 比例 */}
          <div>
            <p className="text-[11px] text-white/50 font-medium mb-2">比例</p>
            <div className="flex flex-wrap gap-1.5">
              {ASPECT_OPTIONS.map((ar) => {
                const supported = isAspectSupported(ar.label);
                return (
                  <button key={ar.label} onClick={() => supported && handleAspectSelect(ar.label)}
                    disabled={!supported}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all ${
                      !supported ? "opacity-25 cursor-not-allowed border-white/5 text-white/20" :
                      curAspectKey === ar.label
                        ? "border-white/30 bg-white/12 text-white"
                        : "border-white/8 text-white/50 hover:border-white/15 hover:text-white/70"
                    }`}>
                    {ar.w > 0 ? (
                      <div className="border border-current rounded-sm opacity-50" style={{
                        width: ar.w > ar.h ? 18 : ar.w === ar.h ? 12 : 10,
                        height: ar.h > ar.w ? 18 : ar.w === ar.h ? 12 : 10,
                      }} />
                    ) : (
                      <span className="text-[10px]">Auto</span>
                    )}
                    <span className="text-[10px] font-medium">{ar.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 清晰度 */}
          <div>
            <p className="text-[11px] text-white/50 font-medium mb-2">清晰度</p>
            <div className="flex gap-1.5">
              {resolutions.map((res) => {
                const supported = isResSupported(res);
                return (
                  <button key={res} onClick={() => supported && handleResSelect(res)}
                    disabled={!supported}
                    className={`px-4 py-2 rounded-lg border text-[12px] font-medium transition-all ${
                      !supported ? "opacity-25 cursor-not-allowed border-white/5 text-white/20" :
                      curShortSide === res
                        ? "border-white/30 bg-white/12 text-white"
                        : "border-white/8 text-white/50 hover:border-white/15 hover:text-white/70"
                    }`}>
                    {res}P
                  </button>
                );
              })}
            </div>
          </div>

          {/* 视频时长 */}
          {mode === "video" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-white/50 font-medium">视频时长</p>
                <span className="text-[11px] text-white/60 font-mono">{durationSec}s</span>
              </div>
              <input type="range"
                min={constraints.duration_range?.[0] ?? 1}
                max={constraints.duration_range?.[1] ?? 15}
                step={1} value={durationSec}
                onChange={(e) => handleDurationChange(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-white/12 cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-blue-400 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
            </div>
          )}

          {/* 生成音频（仅视频） */}
          {mode === "video" && (
            <div>
              <p className="text-[11px] text-white/50 font-medium mb-2">生成音频</p>
              <div className="flex gap-2">
                <button onClick={handleSoundToggle}
                  className={`flex-1 py-2 rounded-lg border text-[12px] font-medium transition-all ${
                    soundEffects ? "border-white/30 bg-white/12 text-white" : "border-white/8 text-white/50 hover:border-white/15"
                  }`}>
                  开启
                </button>
                <button onClick={handleSoundToggle}
                  className={`flex-1 py-2 rounded-lg border text-[12px] font-medium transition-all ${
                    !soundEffects ? "border-white/30 bg-white/12 text-white" : "border-white/8 text-white/50 hover:border-white/15"
                  }`}>
                  关闭
                </button>
              </div>
            </div>
          )}

          {/* 关闭按钮 */}
          <button onClick={() => setShowParamDrop(false)}
            className="w-full py-2 rounded-lg border border-white/10 text-[11px] text-white/50 hover:text-white/70 hover:border-white/20 transition-colors">
            关闭
          </button>
        </div>
      )}
    </>
  );
}
