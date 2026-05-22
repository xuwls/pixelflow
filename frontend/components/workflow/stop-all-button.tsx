"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cancelAllWorkflows } from "@/lib/api/workflow";
import { useProjectStore } from "@/lib/store/project-store";
import { toast } from "sonner";
import { OctagonX } from "lucide-react";
import { useEffect } from "react";

export function StopAllButton() {
  const projects = useProjectStore((s) => s.projects);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const [loading, setLoading] = useState(false);

  const hasRunning = projects.some((p) => p.status === "processing");

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 10000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const handleStopAll = async () => {
    setLoading(true);
    try {
      const res = await cancelAllWorkflows();
      toast.success(`已停止 ${res.cancelled_count} 个运行中的流水线`);
      fetchProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "停止失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!hasRunning) return null;

  return (
    <Button
      onClick={handleStopAll}
      disabled={loading}
      variant="destructive"
      size="sm"
      className="font-mono text-xs tracking-wider gap-1.5"
    >
      <OctagonX className="w-3.5 h-3.5" />
      {loading ? "停止中…" : "全部停止"}
    </Button>
  );
}
