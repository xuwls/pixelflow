"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";
import {
  Upload, Scan, Sparkles, FileText, Layout,
  Wand, Image as ImageIcon, Video, Type, Mic, Clapperboard,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Upload, Scan, Sparkles, FileText, Layout,
  Wand, Image: ImageIcon, Video, Type, Mic, Clapperboard,
};

interface CustomNodeData {
  label: string;
  index: number;
  icon: string;
  status: string;
  outputSummary?: string;
}

function CustomNodeComponent({ data, selected }: { data: CustomNodeData; selected?: boolean }) {
  const Icon = iconMap[data.icon] || FileText;
  const isRunning = data.status === "running";
  const isDone = data.status === "completed";
  const isFail = data.status === "failed";

  return (
    <div
      className={cn(
        "relative bg-card text-card-foreground border min-w-[230px] rounded-md transition-all",
        "px-3 py-2.5",
        selected ? "border-signal shadow-[0_0_0_1px_var(--signal)]" : "border-border",
        isRunning && "border-signal",
        isDone && "border-foreground/30",
        isFail && "border-destructive/70",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-foreground/40 !w-1.5 !h-1.5" />

      {/* index strip */}
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground">
          {String(data.index + 1).padStart(2, "0")}
        </span>
        <span className="h-px flex-1 bg-border" />
        <StatusBadge status={data.status} />
      </div>

      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn(
            "w-6 h-6 rounded-sm border grid place-items-center transition-colors",
            isRunning ? "border-signal/60 bg-signal/10 text-signal" : "border-border bg-muted/40 text-muted-foreground",
            isDone && "border-foreground/30 text-foreground",
            isFail && "border-destructive/70 text-destructive",
          )}
        >
          <Icon className="w-3 h-3" />
        </div>
        <span className="text-[13px] font-medium tracking-wide">{data.label}</span>
      </div>

      {data.outputSummary && (
        <p className="mt-1 text-[11px] text-muted-foreground truncate font-mono">
          ▸ {data.outputSummary}
        </p>
      )}

      {/* running indicator strip */}
      {isRunning && (
        <div className="absolute -bottom-px left-2 right-2 h-px overflow-hidden">
          <div className="h-full w-1/3 bg-signal animate-[ticker_1.6s_linear_infinite]" />
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-foreground/40 !w-1.5 !h-1.5" />
    </div>
  );
}

export const CustomNode = memo(CustomNodeComponent);
