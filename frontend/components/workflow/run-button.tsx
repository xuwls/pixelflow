"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { triggerWorkflow } from "@/lib/api/workflow";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Play, Loader2 } from "lucide-react";

export function RunButton({ projectId }: { projectId: number }) {
  const isRunning = useWorkflowStore((s) => s.isRunning);
  const setRunning = useWorkflowStore((s) => s.setRunning);
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    setLoading(true);
    try {
      await triggerWorkflow(projectId);
      setRunning(true);
      toast.success("流水线已启动");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "启动失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const busy = isRunning || loading;

  return (
    <Button
      onClick={handleRun}
      disabled={busy}
      size="sm"
      className={cn(
        "font-mono text-xs tracking-wider gap-2 px-4",
        busy
          ? "bg-warn/20 text-warn hover:bg-warn/20"
          : "bg-signal text-signal-foreground hover:bg-signal/90"
      )}
    >
      {busy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Play className="w-3.5 h-3.5 fill-current" />
      )}
      {isRunning ? "运行中…" : loading ? "启动中…" : "启动 RUN"}
    </Button>
  );
}
