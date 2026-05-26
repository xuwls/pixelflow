"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas";
import { NodeConfigPanel } from "@/components/workflow/node-config-panel";
import { useProjectStore } from "@/lib/store/project-store";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { useWebSocket } from "@/lib/hooks/use-websocket";
import { StatusBadge } from "@/components/workflow/status-badge";
import { ArrowLeft, PanelRightClose, PanelRightOpen, Loader2 } from "lucide-react";

export default function WorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);
  const { currentProject, isLoading, loadProject } = useProjectStore();
  const setGraph = useWorkflowStore((s) => s.setGraph);
  const reset = useWorkflowStore((s) => s.reset);
  const nodes = useWorkflowStore((s) => s.nodes);
  const [rightOpen, setRightOpen] = useState(true);

  useWebSocket(projectId);

  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
    return () => {
      reset();
    };
  }, [projectId, loadProject, reset]);

  useEffect(() => {
    if (currentProject?.id === projectId) {
      setGraph(currentProject.nodes ?? [], currentProject.edges ?? []);
    }
  }, [currentProject, projectId, setGraph]);

  if (isLoading || !currentProject) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 grid place-items-center bg-hairline">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-signal" />
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase">
              LOADING · 加载工程中
            </p>
          </div>
        </div>
      </div>
    );
  }

  const completedCount = nodes.filter((n) => n.status === "completed").length;
  const runningCount = nodes.filter((n) => n.status === "running").length;
  const failedCount = nodes.filter((n) => n.status === "failed").length;

  return (
    <div className="h-screen flex flex-col bg-background">
      <SiteHeader />

      <div className="border-b border-border bg-secondary/20">
        <div className="px-6 h-12 flex items-center justify-between gap-4 max-w-[1600px] mx-auto w-full">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push("/projects")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
              PROJECT · {String(projectId).padStart(4, "0")}
            </span>
            <span className="w-px h-3.5 bg-border" />
            <h2
              className="text-lg leading-none tracking-wide truncate"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
            >
              {currentProject.name}
            </h2>
            <StatusBadge status={currentProject.status} />
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
              <span>
                <span className="text-foreground tabular-nums">{completedCount}</span>
                <span className="opacity-60">/{nodes.length}</span> 完成
              </span>
              {runningCount > 0 && (
                <span className="text-signal flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-signal pulse-dot" />
                  {runningCount} 运行中
                </span>
              )}
              {failedCount > 0 && (
                <span className="text-destructive">{failedCount} 失败</span>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex flex-col min-w-0">
          <div className="px-4 h-10 border-b border-border flex items-center justify-between bg-background/40">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-signal">
                ◉ CANVAS · 自由画布
              </span>
              <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground hidden sm:inline">
                右键空白处新建 · 拖动连线
              </span>
            </div>
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
              SCROLL TO ZOOM · DRAG TO PAN
            </span>
          </div>
          <div className="flex-1 relative bg-hairline">
            <WorkflowCanvas projectId={projectId} />
          </div>
        </main>

        {rightOpen ? (
          <aside className="w-96 border-l border-border bg-sidebar flex flex-col shrink-0">
            <div className="px-4 h-10 border-b border-border flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                CONFIG · 配置
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setRightOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <PanelRightClose className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <NodeConfigPanel projectId={projectId} />
            </div>
          </aside>
        ) : (
          <Button
            variant="outline"
            size="icon-sm"
            className="absolute right-3 top-3 z-10 border-border bg-card"
            onClick={() => setRightOpen(true)}
          >
            <PanelRightOpen className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
