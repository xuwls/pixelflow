"use client";

import { useEffect, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listModels } from "@/lib/api/models";
import {
  KIND_LABELS,
  KIND_TO_CAPABILITY,
  type ModelEntry,
  type NodeKind,
} from "@/lib/types/capability";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

// ── aspect ratio + resolution presets ──────────────────────────

interface AspectPreset { label: string; w: number; h: number; }

const ASPECT_RATIOS: AspectPreset[] = [
  { label: "16:9", w: 16, h: 9 },
  { label: "1:1",  w: 1,  h: 1 },
  { label: "9:16", w: 9,  h: 16 },
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

function computeDims(aspectW: number, aspectH: number, baseRes: number): { w: number; h: number } {
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

export function PendingNodeDialog({ open, kind, sourceCount, onConfirm, onCancel }: PendingNodeDialogProps) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [width, setWidth] = useState(kind === "video" ? 1080 : 1024);
  const [height, setHeight] = useState(kind === "video" ? 1920 : 1024);
  const [durationSec, setDurationSec] = useState(5);
  const [soundEffects, setSoundEffects] = useState(true);
  const [multiShot, setMultiShot] = useState(true);
  const [modelKey, setModelKey] = useState("");

  const { models, loading: loadingModels } = useModelsForKind(kind);

  // auto-select default model
  useEffect(() => {
    if (!modelKey && models.length > 0) {
      const def = models.find((m) => m.is_default) ?? models[0];
      setModelKey(`${def.provider}:${def.model_name}`);
    }
  }, [models, modelKey]);

  const curShortSide = Math.min(width, height);
  const curAspectKey = (() => {
    const r = width / height;
    if (r > 1.6) return "16:9";
    if (r < 0.6) return "9:16";
    return "1:1";
  })();

  function handleAspect(aspect: AspectPreset) {
    const { w, h } = computeDims(aspect.w, aspect.h, curShortSide || 1024);
    setWidth(w);
    setHeight(h);
  }

  function handleResolution(res: ResolutionPreset) {
    const cur = ASPECT_RATIOS.find((a) => a.label === curAspectKey) ?? ASPECT_RATIOS[0];
    const { w, h } = computeDims(cur.w, cur.h, res.base);
    setWidth(w);
    setHeight(h);
  }

  function handleConfirm() {
    const [provider, model_name] = modelKey.split(":");
    const selectedModel = models.find((m) => m.provider === provider && m.model_name === model_name);
    onConfirm({
      kind,
      title: title.trim() || undefined as unknown as string,
      prompt: prompt.trim(),
      config_json: {
        model: { provider, model_name, display_name: selectedModel?.display_name },
        width,
        height,
        ...(kind === "video" ? { duration_sec: durationSec, sound_effects: soundEffects, multi_shot: multiShot } : {}),
      },
    });
  }

  const isGen = kind === "image" || kind === "video";
  const hasPrompt = Boolean(prompt.trim());

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* header */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border/40 bg-secondary/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="accent-dot" />
            <DialogTitle className="font-mono text-[10px] tracking-[0.25em] uppercase text-signal">
              新建{KIND_LABELS[kind]}节点
            </DialogTitle>
          </div>
          <p className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground mt-1">
            引用 {sourceCount} 个素材
          </p>
        </DialogHeader>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* title */}
          <section className="space-y-1.5">
            <Label className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground/70">
              标题
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="给节点起个名字 (可选)"
              className="bg-background border-border"
            />
          </section>

          {/* prompt */}
          <section className="space-y-1.5">
            <Label className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground/70">
              提示词
            </Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="描述你想要生成的画面…"
              className="bg-background border-border font-mono text-[12px] leading-relaxed resize-none"
            />
          </section>

          {/* params (gen only) */}
          {isGen && (
            <>
              {/* aspect ratio */}
              <section className="space-y-1.5">
                <span className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground/70">比例</span>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIOS.map((ar) => {
                    const active = curAspectKey === ar.label;
                    return (
                      <button
                        key={ar.label}
                        type="button"
                        onClick={() => handleAspect(ar)}
                        className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border transition-all ${
                          active ? "border-signal bg-signal/8 text-signal" : "border-border/40 bg-background text-muted-foreground hover:border-border"
                        }`}
                      >
                        <div className="border border-current rounded-sm opacity-50" style={{
                          width: ar.w > ar.h ? 24 : ar.w === ar.h ? 16 : 14,
                          height: ar.h > ar.w ? 24 : ar.w === ar.h ? 16 : 14,
                        }} />
                        <span className="text-[10px] font-mono tracking-wider">{ar.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* resolution */}
              <section className="space-y-1.5">
                <span className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground/70">分辨率</span>
                <div className={kind === "video" ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2"}>
                  {(kind === "video" ? VIDEO_RESOLUTIONS : IMAGE_RESOLUTIONS).map((res) => {
                    const active = curShortSide === res.base;
                    return (
                      <button
                        key={res.label}
                        type="button"
                        onClick={() => handleResolution(res)}
                        className={`relative flex items-center justify-center py-2 rounded-lg border transition-all ${
                          active ? "border-signal bg-signal/8 text-signal" : "border-border/40 bg-background text-muted-foreground hover:border-border"
                        }`}
                      >
                        <span className="text-[11px] font-mono tracking-wider">{res.label}</span>
                        {res.vip && (
                          <span className="absolute -top-1.5 -right-1.5 text-[8px] px-1 py-0.5 rounded-sm bg-amber-400 text-amber-900 font-bold leading-none shadow-sm">VIP</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* duration slider (video only) */}
              {kind === "video" && (
                <section className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground/70">时长</span>
                    <span className="text-[11px] font-mono text-signal/80">{durationSec}s</span>
                  </div>
                  <input
                    type="range"
                    min={1} max={15} step={1}
                    value={durationSec}
                    onChange={(e) => setDurationSec(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-border/50 cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-signal
                      [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-signal [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-muted-foreground/40">
                    <span>1s</span><span>15s</span>
                  </div>
                </section>
              )}

              {/* advanced toggles (video only) */}
              {kind === "video" && (
                <section className="space-y-1.5">
                  <span className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground/70">高级设置</span>
                  <ToggleRow label="音效" hint="自动生成配音或环境音" active={soundEffects} onToggle={() => setSoundEffects((v) => !v)} />
                  <ToggleRow label="多镜头" hint="AI 生成分镜头多机位视频" active={multiShot} onToggle={() => setMultiShot((v) => !v)} />
                </section>
              )}

              {/* model */}
              <section className="space-y-1.5">
                <span className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground/70">模型</span>
                {loadingModels ? (
                  <div className="h-9 rounded-md border border-border bg-background flex items-center px-3 text-xs text-muted-foreground">加载中…</div>
                ) : models.length === 0 ? (
                  <div className="h-9 rounded-md border border-dashed border-border bg-background flex items-center px-3 text-xs text-muted-foreground">暂无模型</div>
                ) : (
                  <Select value={modelKey} onValueChange={(v) => v && setModelKey(v)}>
                    <SelectTrigger className="bg-background border-border w-full">
                      <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={`${m.provider}:${m.model_name}`} value={`${m.provider}:${m.model_name}`}>
                          <div className="flex flex-col">
                            <span className="text-xs">{m.display_name}</span>
                            <span className="font-mono text-[9px] text-muted-foreground">{m.provider} / {m.model_name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </section>
            </>
          )}
        </div>

        {/* footer */}
        <div className="px-4 py-3 border-t border-border/40 bg-secondary/10 grid grid-cols-2 gap-2 shrink-0">
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!hasPrompt || !modelKey}
            className="bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs tracking-wider gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            确认创建
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="font-mono text-xs tracking-wider gap-1.5 border-border"
          >
            <X className="w-3.5 h-3.5" />
            取消
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ label, hint, active, onToggle }: { label: string; hint: string; active: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-foreground/80">{label}</span>
        <span className="text-[10px] text-muted-foreground/50 cursor-help" title={hint}>?</span>
      </div>
      <button
        type="button" role="switch" aria-checked={active} onClick={onToggle}
        className={`relative w-9 h-5 rounded-full transition-colors ${active ? "bg-signal" : "bg-border/50"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${active ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
