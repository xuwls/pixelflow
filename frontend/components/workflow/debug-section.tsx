"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronRight, Clock, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

interface DebugSectionProps {
  debugLog: Record<string, unknown> | null;
}

export function DebugSection({ debugLog }: DebugSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (!debugLog) return null;

  const duration_ms = debugLog.duration_ms as number | undefined;
  const input = debugLog.input as Record<string, unknown> | undefined;
  const output = debugLog.output as Record<string, unknown> | undefined;
  const calls = debugLog.calls as Array<Record<string, unknown>> | undefined;

  return (
    <div className="space-y-2">
      <Separator className="bg-border" />
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-1 py-1 text-left font-mono text-[10px] tracking-[0.2em] uppercase text-warn hover:text-warn/80 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        DEBUG · 调试
        {duration_ms != null && (
          <span className="ml-auto flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            {duration_ms} ms
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-2">
          {calls && calls.length > 0 ? (
            calls.map((call, i) => (
              <div key={i} className="border border-warn/30 bg-warn/5 rounded-sm p-2">
                <p className="font-mono text-[10px] tracking-wider text-warn mb-1.5">
                  CALL {String(i + 1).padStart(2, "0")} · 镜头 {String(call.scene_index ?? "—")}
                  {call.duration_ms != null && (
                    <span className="ml-2 text-muted-foreground">
                      {String(call.duration_ms)}ms
                    </span>
                  )}
                </p>
                <DebugBlock label="输入" data={call.input as Record<string, unknown>} icon="in" />
                <DebugBlock label="输出" data={call.output as Record<string, unknown>} icon="out" />
              </div>
            ))
          ) : (
            <>
              <DebugBlock label="输入" data={input ?? null} icon="in" />
              <DebugBlock label="输出" data={output ?? null} icon="out" />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DebugBlock({
  label,
  data,
  icon,
}: {
  label: string;
  data: Record<string, unknown> | null;
  icon: "in" | "out";
}) {
  const [open, setOpen] = useState(label === "输入");
  if (!data) return null;
  const Icon = icon === "in" ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors w-full text-left py-0.5 font-mono text-[10px] tracking-wider uppercase"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Icon className="w-3 h-3" />
        {label}
      </button>
      {open && (
        <pre className="mt-1 p-2 bg-background border border-border rounded-sm font-mono text-[10.5px] leading-relaxed text-foreground/80 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
