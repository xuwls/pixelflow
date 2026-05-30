"use client";

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";
import { KIND_LABELS, type NodeKind } from "@/lib/types/capability";
import type { NodeStatus } from "@/lib/types/workflow";
import { FileText, Image as ImageIcon, Video } from "lucide-react";

const KIND_ICONS: Record<NodeKind, React.ComponentType<{ className?: string }>> = {
  text: FileText,
  image: ImageIcon,
  video: Video,
};

const STORAGE_BASE =
  process.env.NEXT_PUBLIC_STORAGE_URL || "http://localhost:9000/pixelflow";

function resolveAssetUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${STORAGE_BASE}/${value.replace(/^\/+/, "")}`;
}

function pickPreview(
  kind: NodeKind,
  output: Record<string, unknown> | null,
): { kind: "image" | "video" | "text"; src?: string; text?: string } | null {
  if (!output) return null;

  if (kind === "image") {
    const images = output.images as Array<{ url?: string }> | undefined;
    const url = images?.[0]?.url ?? (output.url as string | undefined);
    const resolved = resolveAssetUrl(url);
    if (resolved) return { kind: "image", src: resolved };
  }

  if (kind === "video") {
    const videos = output.videos as Array<{ url?: string }> | undefined;
    const url = videos?.[0]?.url ?? (output.url as string | undefined);
    const resolved = resolveAssetUrl(url);
    if (resolved) return { kind: "video", src: resolved };
  }

  if (kind === "text") {
    const candidates = [output.text, output.content, output.title, output.summary];
    const found = candidates.find((v) => typeof v === "string" && v.trim());
    if (typeof found === "string") return { kind: "text", text: found };
  }

  return null;
}

export interface CustomNodeData extends Record<string, unknown> {
  kind: NodeKind;
  title: string | null;
  prompt: string | null;
  status: NodeStatus;
  output_json: Record<string, unknown> | null;
  error_message: string | null;
}

function CustomNodeComponent({ data, selected }: NodeProps) {
  const d = data as CustomNodeData;
  const Icon = KIND_ICONS[d.kind];
  const preview = useMemo(() => pickPreview(d.kind, d.output_json), [d.kind, d.output_json]);

  const isRunning = d.status === "running";
  const isDone = d.status === "completed";
  const isFail = d.status === "failed";

  const hasMedia = !!preview?.src;

  return (
    <div
      className={cn(
        "relative glass-card text-card-foreground rounded-xl transition-all duration-200 overflow-hidden",
        hasMedia ? "w-[280px]" : "w-[240px]",
        "hover:shadow-md",
        selected ? "!border-signal shadow-glow" : "",
        isRunning && "!border-signal",
        isDone && !selected && "!border-foreground/20",
        isFail && "!border-destructive/60",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-foreground/40 !w-2 !h-2 !border-0"
      />

      {/* ====== 图片/视频：有 output → 全屏铺开 ====== */}
      {hasMedia && (
        <div className="relative">
          {preview!.kind === "image" && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={preview!.src}
              alt=""
              className="w-full h-auto block"
              draggable={false}
            />
          )}

          {preview!.kind === "video" && (
            <div className="relative aspect-[4/3] bg-black">
              <video
                src={preview!.src}
                className="absolute inset-0 w-full h-full object-cover"
                muted
                loop
                playsInline
                preload="metadata"
              />
            </div>
          )}

          {/* 底部渐变遮罩 */}
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

          {d.title && (
            <p className="absolute bottom-5 left-2.5 right-2.5 text-[11px] font-medium text-white truncate drop-shadow-md">
              {d.title}
            </p>
          )}

          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/45 backdrop-blur-sm text-[9px] font-mono tracking-wider uppercase text-white/90">
              <Icon className="w-2.5 h-2.5" />
              {KIND_LABELS[d.kind]}
            </span>
          </div>

          {/* 已完成不显示状态 — 图片本身就是结果；只在 running / failed 等时显示 */}
          {!isDone && (
            <div className="absolute top-2 right-2">
              <StatusBadge status={d.status} />
            </div>
          )}
        </div>
      )}

      {/* ====== 图片/视频：无 output → 空白占位 ====== */}
      {!hasMedia && d.kind === "image" && (
        <div className="relative aspect-square bg-gradient-to-br from-muted/60 via-muted/30 to-muted/60">
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-1.5">
              <Icon className="w-6 h-6 text-muted-foreground/40" />
              <span className="text-[9px] font-mono tracking-wider uppercase text-muted-foreground/50">
                {KIND_LABELS[d.kind]}
              </span>
            </div>
          </div>
          {isRunning && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="w-10 h-10 rounded-full border-2 border-signal/30 border-t-signal animate-spin" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <StatusBadge status={d.status} />
          </div>
        </div>
      )}

      {!hasMedia && d.kind === "video" && (
        <div className="relative aspect-[4/3] overflow-hidden">
          {/* 毛玻璃模糊底图 */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/20 via-purple-400/15 to-pink-400/20 backdrop-blur-xl" />
          <div className="absolute inset-0 bg-secondary/30 backdrop-blur-sm" />

          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-1.5">
              <Icon className="w-6 h-6 text-muted-foreground/50" />
              <span className="text-[9px] font-mono tracking-wider uppercase text-muted-foreground/60">
                {KIND_LABELS[d.kind]}
              </span>
            </div>
          </div>
          {isRunning && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="w-10 h-10 rounded-full border-2 border-signal/30 border-t-signal animate-spin" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <StatusBadge status={d.status} />
          </div>
        </div>
      )}

      {/* ====== 文本节点 ====== */}
      {!hasMedia && d.kind === "text" && (
        <div className="relative bg-gradient-to-br from-secondary/40 via-secondary/20 to-secondary/40">
          {/* 左上角类型标签 */}
          <div className="absolute top-2 left-2 z-10">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/45 backdrop-blur-sm text-[9px] font-mono tracking-wider uppercase text-white/90">
              <Icon className="w-2.5 h-2.5" />
              {KIND_LABELS[d.kind]}
            </span>
          </div>

          {/* 右上角状态 */}
          <div className="absolute top-2 right-2 z-10">
            <StatusBadge status={d.status} />
          </div>

          {/* 内容区 */}
          <div className="px-3 pt-8 pb-3">
            {d.title && (
              <p className="text-[12px] font-medium tracking-wide truncate mb-1">
                {d.title}
              </p>
            )}

            {preview?.kind === "text" && preview.text && (
              <p className="text-[11px] leading-relaxed text-foreground/85 line-clamp-4 whitespace-pre-wrap">
                {preview.text}
              </p>
            )}

            {!preview && d.prompt && (
              <p className="text-[11px] leading-snug text-muted-foreground line-clamp-3 italic">
                ▸ {d.prompt}
              </p>
            )}

            {!preview && !d.prompt && (
              <p className="text-[10px] text-muted-foreground/60 font-mono tracking-wider uppercase py-1">
                empty · 右键编辑
              </p>
            )}
          </div>

          {/* 运行中遮罩 */}
          {isRunning && (
            <div className="absolute inset-0 grid place-items-center bg-background/40 backdrop-blur-[2px]">
              <div className="w-10 h-10 rounded-full border-2 border-signal/30 border-t-signal animate-spin" />
            </div>
          )}
        </div>
      )}

      {isFail && d.error_message && (
        <p className="px-3 py-1.5 text-[10px] text-destructive bg-destructive/10 line-clamp-2 font-mono leading-tight">
          {d.error_message}
        </p>
      )}

      {isRunning && (
        <div className="absolute -bottom-px left-2 right-2 h-px overflow-hidden">
          <div className="h-full w-1/3 bg-signal animate-[ticker_1.6s_linear_infinite]" />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-foreground/40 !w-2 !h-2 !border-0"
      />
    </div>
  );
}

export const CustomNode = memo(CustomNodeComponent);
