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

  return (
    <div
      className={cn(
        "relative glass-card text-card-foreground rounded-xl transition-all duration-200 overflow-hidden",
        "w-[240px] hover:shadow-md",
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

      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-secondary/20">
        <div
          className={cn(
            "w-5 h-5 rounded-sm border grid place-items-center",
            isRunning
              ? "border-signal/60 bg-signal/10 text-signal"
              : "border-border bg-muted/40 text-muted-foreground",
            isDone && "border-foreground/30 text-foreground",
            isFail && "border-destructive/70 text-destructive",
          )}
        >
          <Icon className="w-3 h-3" />
        </div>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
          {KIND_LABELS[d.kind]}
        </span>
        <span className="flex-1" />
        <StatusBadge status={d.status} />
      </div>

      {d.title && (
        <p className="px-3 pt-2 text-[12px] font-medium tracking-wide truncate">
          {d.title}
        </p>
      )}

      {preview?.kind === "image" && preview.src && (
        <div className="aspect-video bg-muted/30 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.src}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
      )}

      {preview?.kind === "video" && preview.src && (
        <div className="aspect-video bg-black overflow-hidden">
          <video
            src={preview.src}
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
            preload="metadata"
          />
        </div>
      )}

      {preview?.kind === "text" && preview.text && (
        <p className="px-3 pt-1 pb-2 text-[11px] leading-relaxed text-foreground/85 line-clamp-4 whitespace-pre-wrap">
          {preview.text}
        </p>
      )}

      {!preview && d.prompt && (
        <p className="px-3 pt-1 pb-2 text-[11px] leading-snug text-muted-foreground line-clamp-3 italic">
          ▸ {d.prompt}
        </p>
      )}

      {!preview && !d.prompt && (
        <p className="px-3 py-3 text-[10px] text-muted-foreground/70 font-mono tracking-wider uppercase">
          empty · 右键编辑
        </p>
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
