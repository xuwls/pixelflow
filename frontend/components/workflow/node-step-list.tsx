"use client";

import { useWorkflowStore } from "@/lib/store/workflow-store";
import { StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";
import {
  Upload, Scan, Sparkles, FileText, Layout,
  Wand, Image as ImageIcon, Video, Type, Mic, Clapperboard,
} from "lucide-react";

const PIPELINE_STEPS = [
  { type: "product_input",          label: "商品输入",      hint: "上传素材",     icon: Upload },
  { type: "product_understanding",  label: "商品理解",      hint: "AI 解析",      icon: Scan },
  { type: "selling_point",          label: "卖点生成",      hint: "营销文案",     icon: Sparkles },
  { type: "script",                 label: "脚本生成",      hint: "口播 / CTA",   icon: FileText },
  { type: "storyboard",             label: "分镜生成",      hint: "镜头拆分",     icon: Layout },
  { type: "prompt",                 label: "提示词生成",    hint: "图 / 视频 prompt", icon: Wand },
  { type: "keyframe",               label: "关键帧生成",    hint: "通义万相",     icon: ImageIcon },
  { type: "video_generation",       label: "视频生成",      hint: "镜头片段",     icon: Video },
  { type: "subtitle",               label: "字幕生成",      hint: "SRT 时间轴",   icon: Type },
  { type: "voiceover",              label: "配音生成",      hint: "TTS",          icon: Mic },
  { type: "video_composition",      label: "视频合成",      hint: "FFmpeg",       icon: Clapperboard },
];

export function NodeStepList() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const nodeMap = new Map(nodes.map((n) => [n.node_type, n]));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-3 border-b border-border flex items-baseline justify-between">
        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
          PIPELINE · 流水线
        </p>
        <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
          11 / 段
        </p>
      </div>

      <ol className="px-2 py-2">
        {PIPELINE_STEPS.map((step, i) => {
          const dbNode = nodeMap.get(step.type);
          const status = dbNode?.status || "pending";
          const isSelected = dbNode?.id != null && dbNode.id === selectedNodeId;
          const isRunning = status === "running";
          const Icon = step.icon;

          return (
            <li key={step.type} className="relative">
              {/* connector line between items */}
              {i < PIPELINE_STEPS.length - 1 && (
                <span className="absolute left-[28px] top-[42px] bottom-[-8px] w-px bg-border" aria-hidden />
              )}

              <button
                type="button"
                onClick={() => dbNode && selectNode(dbNode.id)}
                className={cn(
                  "relative w-full flex items-start gap-3 px-2 py-2 rounded-sm text-left group transition-colors",
                  "hover:bg-secondary/60",
                  isSelected && "bg-secondary"
                )}
              >
                <div
                  className={cn(
                    "shrink-0 w-7 h-7 rounded-sm border grid place-items-center text-[10px] font-mono tracking-tight",
                    "bg-background relative z-10 transition-colors",
                    isRunning ? "border-signal text-signal" : "border-border text-muted-foreground",
                    status === "completed" && "border-foreground/40 text-foreground",
                    status === "failed" && "border-destructive text-destructive",
                    isSelected && "border-signal text-signal",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="text-sm tracking-wide text-foreground truncate">
                      {step.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground truncate">
                      {step.hint}
                    </span>
                    <StatusBadge status={status} />
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
