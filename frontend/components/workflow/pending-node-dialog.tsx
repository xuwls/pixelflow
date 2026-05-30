"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { listModels } from "@/lib/api/models";
import {
  KIND_LABELS,
  KIND_TO_CAPABILITY,
  type ModelEntry,
  type NodeKind,
} from "@/lib/types/capability";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, Video, Sparkles, X } from "lucide-react";

// ── presets ────────────────────────────────────────────────────

interface AspectPreset { label: string; w: number; h: number; }

const ASPECT_RATIOS: AspectPreset[] = [
  { label: "16:9", w: 16, h: 9 },
  { label: "1:1", w: 1, h: 1 },
  { label: "9:16", w: 9, h: 16 },
];

interface ResolutionPreset { label: string; base: number; vip?: boolean; }

const VIDEO_RESOLUTIONS: ResolutionPreset[] = [
  { label: "720P", base: 720 },
  { label: "1080P", base: 1080, vip: true },
];

const IMAGE_RESOLUTIONS: ResolutionPreset[] = [
  { label: "SD", base: 1024 },
  { label: "HD", base: 1920 },
  { label: "2K", base: 2048 },
];

function computeDims(aspectW: number, aspectH: number, baseRes: number) {
  if (aspectW > aspectH) return { w: Math.round(baseRes * aspectW / aspectH), h: baseRes };
  if (aspectH > aspectW) return { w: baseRes, h: Math.round(baseRes * aspectH / aspectW) };
  return { w: baseRes, h: baseRes };
}

// ── model hook ────────────────────────────────────────────────

function useModelsForKind(kind: NodeKind | undefined): { models: ModelEntry[]; loading: boolean } {
  const [state, setState] = useState<{ kind: NodeKind | null; models: ModelEntry[] }>({ kind: null, models: [] });
  useEffect(() => {
    if (!kind) return;
    let cancelled = false;
    const cap = KIND_TO_CAPABILITY[kind];
    listModels(cap)
      .then((res) => { if (!cancelled) setState({ kind, models: res.models }); })
      .catch(() => { if (!cancelled) { setState({ kind, models: [] }); toast.error("加载模型列表失败"); } });
    return () => { cancelled = true; };
  }, [kind]);
  return { models: state.kind === kind ? state.models : [], loading: state.kind !== kind };
}

// ── mode config ────────────────────────────────────────────────

const MODES: { kind: NodeKind; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { kind: "video", icon: Video, label: "视频" },
  { kind: "image", icon: ImageIcon, label: "图片" },
  { kind: "text",  icon: FileText, label: "文本" },
];

// ── props ─────────────────────────────────────────────────────

export interface PendingNodeConfig {
  kind: NodeKind;
  title: string;
  prompt: string;
  config_json: Record<string, unknown>;
}

interface PendingNodeDialogProps {
  open: boolean;
  kind: NodeKind;
  sourceCount: number;
  onConfirm: (config: PendingNodeConfig) => void;
  onCancel: () => void;
}

export function PendingNodeDialog({ open, kind: initialKind, sourceCount, onConfirm, onCancel }: PendingNodeDialogProps) {
  const [kind, setKind] = useState<NodeKind>(initialKind);
  const [prompt, setPrompt] = useState("");
  const [width, setWidth] = useState(initialKind === "video" ? 1080 : 1024);
  const [height, setHeight] = useState(initialKind === "video" ? 1920 : 1024);
  const [durationSec, setDurationSec] = useState(5);
  const [soundEffects, setSoundEffects] = useState(true);
  const [multiShot, setMultiShot] = useState(true);
  const [modelKey, setModelKey] = useState("");

  const { models, loading: loadingModels } = useModelsForKind(kind);

  // reset dims when kind changes
  useEffect(() => {
    setWidth(kind === "video" ? 1080 : 1024);
    setHeight(kind === "video" ? 1920 : 1024);
    setModelKey("");
  }, [kind]);

  // auto-select default model
  useEffect(() => {
    if (!modelKey && models.length > 0) {
      const def = models.find((m) => m.is_default) ?? models[0];
      setModelKey(`${def.provider}:${def.model_name}`);
    }
  }, [models, modelKey]);

  const isGen = kind === "image" || kind === "video";
  const curShortSide = Math.min(width, height);
  const curAspectKey = (() => {
    const r = width / height;
    if (r > 1.6) return "16:9";
    if (r < 0.6) return "9:16";
    return "1:1";
  })();

  // 参数约束（根据模型名推导）
  const selectedM = models.find((m) => `${m.provider}:${m.model_name}` === modelKey);
  const constraints = (() => {
    if (!selectedM) return {};
    const mn = selectedM.model_name;
    if (kind === "image") {
      if (mn.startsWith("wanx2.1")) return { supported_sizes: [[1024, 1024], [720, 1280], [1280, 720], [768, 1152], [1152, 768]] };
      if (mn.startsWith("wanx")) return { supported_sizes: [[1024, 1024], [720, 1280], [1280, 720]] };
      return { supported_sizes: [[1024, 1024], [720, 1280], [1280, 720], [768, 1152], [1152, 768], [1536, 1024], [1024, 1536]] };
    }
    if (kind === "video") {
      if (mn.startsWith("wan")) return { supported_resolutions: [720, 1080], duration_range: [1, 5] as [number, number] };
      return { supported_resolutions: [720, 1080], duration_range: [1, 10] as [number, number] };
    }
    return {};
  })();

  function isAspectSupported(label: string): boolean {
    if (!constraints.supported_sizes) return true;
    const ar = ASPECT_RATIOS.find((a) => a.label === label);
    if (!ar) return true;
    return constraints.supported_sizes.some(([sw, sh]) => Math.abs(sw / sh - ar.w / ar.h) < 0.05);
  }

  function isResSupported(res: number): boolean {
    if (kind === "video") {
      if (!constraints.supported_resolutions) return true;
      return constraints.supported_resolutions.includes(res);
    }
    if (!constraints.supported_sizes) return true;
    return constraints.supported_sizes.some(([sw, sh]) => Math.min(sw, sh) === res || Math.max(sw, sh) === res);
  }

  function handleAspect(aspect: AspectPreset) {
    const { w, h } = computeDims(aspect.w, aspect.h, curShortSide || 1024);
    setWidth(w); setHeight(h);
  }

  function handleResolution(res: ResolutionPreset) {
    const cur = ASPECT_RATIOS.find((a) => a.label === curAspectKey) ?? ASPECT_RATIOS[0];
    const { w, h } = computeDims(cur.w, cur.h, res.base);
    setWidth(w); setHeight(h);
  }

  function handleConfirm() {
    if (!modelKey || !prompt.trim()) return;
    const [provider, model_name] = modelKey.split(":");
    const selectedModel = models.find((m) => m.provider === provider && m.model_name === model_name);
    onConfirm({
      kind,
      title: "",
      prompt: prompt.trim(),
      config_json: {
        model: { provider, model_name, display_name: selectedModel?.display_name },
        width, height,
        ...(kind === "video" ? { duration_sec: durationSec, sound_effects: soundEffects, multi_shot: multiShot } : {}),
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl">
        
        {/* ── header: mode tabs ─────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-1 bg-secondary/60 rounded-xl p-1">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = kind === m.kind;
              return (
                <button
                  key={m.kind}
                  onClick={() => setKind(m.kind)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-sm transition-all ${
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── body ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 space-y-5 pb-2">

          {/* model selector */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">模型</p>
            {loadingModels ? (
              <div className="h-10 rounded-xl border border-border/60 bg-secondary/30 flex items-center px-3 text-sm text-muted-foreground">加载中…</div>
            ) : (
              <Select value={modelKey} onValueChange={(v) => v && setModelKey(v)}>
                <SelectTrigger className="h-10 rounded-xl bg-secondary/30 border-border/60 hover:bg-secondary/50 transition-colors">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={`${m.provider}:${m.model_name}`} value={`${m.provider}:${m.model_name}`}>
                      <span>{m.display_name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{m.provider}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* parameters (gen modes only) */}
          {isGen && (
            <>
              {/* aspect ratio */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">比例</p>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIOS.map((ar) => {
                    const active = curAspectKey === ar.label;
                    const supported = isAspectSupported(ar.label);
                    return (
                      <button key={ar.label} type="button" onClick={() => supported && handleAspect(ar)}
                        disabled={!supported}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all ${
                          !supported ? "opacity-25 cursor-not-allowed border-border/20 text-muted-foreground/30" :
                          active ? "border-signal bg-signal/5 text-signal" : "border-border/40 bg-secondary/20 text-muted-foreground hover:border-border/60"
                        }`}
                      >
                        <div className="border border-current rounded-sm opacity-40" style={{
                          width: ar.w > ar.h ? 20 : ar.w === ar.h ? 14 : 12,
                          height: ar.h > ar.w ? 20 : ar.w === ar.h ? 14 : 12,
                        }} />
                        <span className="text-xs font-medium">{ar.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* resolution */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">分辨率</p>
                <div className={kind === "video" ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2"}>
                  {(kind === "video" ? VIDEO_RESOLUTIONS : IMAGE_RESOLUTIONS).map((res) => {
                    const active = curShortSide === res.base;
                    const supported = isResSupported(res.base);
                    return (
                      <button key={res.label} type="button" onClick={() => supported && handleResolution(res)}
                        disabled={!supported}
                        className={`relative flex items-center justify-center py-2.5 rounded-xl border transition-all ${
                          !supported ? "opacity-25 cursor-not-allowed border-border/20 text-muted-foreground/30" :
                          active ? "border-signal bg-signal/5 text-signal" : "border-border/40 bg-secondary/20 text-muted-foreground hover:border-border/60"
                        }`}
                      >
                        <span className="text-sm font-medium">{res.label}</span>
                        {res.vip && (
                          <span className="absolute -top-1.5 -right-1.5 text-[8px] px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-900 font-bold shadow-sm">VIP</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* duration slider (video only) */}
              {kind === "video" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-medium">时长</p>
                    <span className="text-sm font-mono text-foreground/70">{durationSec}s</span>
                  </div>
                  <input type="range"
                    min={constraints.duration_range?.[0] ?? 1}
                    max={constraints.duration_range?.[1] ?? 15}
                    step={1} value={durationSec}
                    onChange={(e) => setDurationSec(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-border/40 cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-signal
                      [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-signal [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                  />
                </div>
              )}

              {/* advanced toggles (video only) */}
              {kind === "video" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">高级</p>
                  <ToggleRow label="音效" hint="自动生成配音或环境音" active={soundEffects} onToggle={() => setSoundEffects((v) => !v)} />
                  <ToggleRow label="多镜头" hint="AI 生成分镜头多机位视频" active={multiShot} onToggle={() => setMultiShot((v) => !v)} />
                </div>
              )}
            </>
          )}

          {/* prompt */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">
              提示词
              {sourceCount > 0 && <span className="ml-1 text-signal/70">· 引用 {sourceCount} 个素材</span>}
            </p>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="描述你想要生成的内容…"
              className="min-h-[100px] rounded-xl bg-secondary/20 border-border/40 resize-none text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:bg-secondary/30 transition-colors"
            />
          </div>
        </div>

        {/* ── footer ────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-border/30">
          <Button variant="ghost" size="sm" onClick={onCancel}
            className="text-muted-foreground hover:text-foreground rounded-xl">
            取消
          </Button>
          <div className="flex-1" />
          <Button size="sm" onClick={handleConfirm}
            disabled={!modelKey || !prompt.trim()}
            className="rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium gap-2 px-5">
            <Sparkles className="w-4 h-4" />
            创建
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}

// ── toggle ─────────────────────────────────────────────────────

function ToggleRow({ label, hint, active, onToggle }: { label: string; hint: string; active: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-foreground/80">{label}</span>
        <span className="text-xs text-muted-foreground/50 cursor-help" title={hint}>?</span>
      </div>
      <button type="button" role="switch" aria-checked={active} onClick={onToggle}
        className={`relative w-9 h-5 rounded-full transition-colors ${active ? "bg-signal" : "bg-border/50"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${active ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
