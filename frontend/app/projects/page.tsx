"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/project/create-project-dialog";
import { useProjectStore } from "@/lib/store/project-store";
import { useUIStore } from "@/lib/store/ui-store";
import { StatusBadge } from "@/components/workflow/status-badge";
import { Plus, Trash2, Search, ImageOff, ArrowUpRight } from "lucide-react";
import type { Project } from "@/lib/types/project";

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  processing: "运行中",
  completed: "完成",
  failed: "失败",
  cancelled: "已取消",
};

export default function ProjectsPage() {
  const { projects, isLoading, fetchProjects, deleteProject } = useProjectStore();
  const openCreateDialog = useUIStore((s) => s.openCreateDialog);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "processing" | "completed" | "draft">("all");

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const counts = useMemo(() => {
    const base = { all: projects.length, processing: 0, completed: 0, draft: 0, failed: 0, cancelled: 0 };
    for (const p of projects) {
      if (p.status in base) (base as Record<string, number>)[p.status] += 1;
    }
    return base;
  }, [projects]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchQ = !query || p.name.toLowerCase().includes(query.toLowerCase());
      const matchF = filter === "all" || p.status === filter;
      return matchQ && matchF;
    });
  }, [projects, query, filter]);

  return (
    <div className="min-h-screen relative grain">
      <SiteHeader />
      <CreateProjectDialog />

      {/* Page banner */}
      <section className="border-b border-border/60 bg-hairline">
        <div className="mx-auto max-w-[1600px] px-8 py-14 grid grid-cols-12 gap-8 items-end">
          <div className="col-span-12 md:col-span-8 reveal reveal-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="accent-dot" />
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-signal">
                § Library · 项目库
              </p>
            </div>
            <h1
              className="text-4xl md:text-6xl leading-[0.95] tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}
            >
              我的<span className="text-signal">.</span>项目
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-md">
              所有正在生成与已完成的视频工程,按时间倒序排列。
            </p>
          </div>
          <div className="col-span-12 md:col-span-4 reveal reveal-2">
            <dl className="grid grid-cols-3 gap-3">
              <Stat label="总数" value={counts.all} />
              <Stat label="运行中" value={counts.processing} accent />
              <Stat label="已完成" value={counts.completed} />
            </dl>
          </div>
        </div>
      </section>

      {/* Toolbar — glass */}
      <section className="border-b border-border/60 sticky top-16 z-30 glass">
        <div className="mx-auto max-w-[1600px] px-8 h-12 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase">
            {(["all", "processing", "completed", "draft"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`h-7 px-3 rounded-full border transition-all duration-200 ${
                  filter === f
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {f === "all" ? "全部" : STATUS_LABEL[f]}
                <span className="ml-1.5 opacity-60 tabular-nums">{counts[f]}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-[200px] flex items-center gap-2 border border-border/60 rounded-full h-8 px-3 bg-background/40 focus-within:border-signal/50 focus-within:shadow-[0_0_0_2px_var(--signal)/8] transition-all duration-200">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="按项目名称搜索…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/50"
            />
            {query && (
              <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground shrink-0">
                {filtered.length} hit
              </span>
            )}
          </div>

          <Button
            onClick={openCreateDialog}
            size="sm"
            className="bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-[11px] tracking-wider gap-1.5 shadow-glow"
          >
            <Plus className="w-3.5 h-3.5" />
            新建项目
          </Button>
        </div>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-[1600px] px-8 py-10">
        {isLoading ? (
          <ProjectGridSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={openCreateDialog} hasProjects={projects.length > 0} />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                index={i}
                onDelete={() => deleteProject(p.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="glass-card px-4 py-4 rounded-xl">
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1">
        {label}
      </p>
      <p
        className={`text-3xl leading-none tabular-nums ${accent ? "text-signal" : "text-foreground"}`}
        style={{ fontFamily: "var(--font-display-en)", fontWeight: 600 }}
      >
        {String(value).padStart(2, "0")}
      </p>
    </div>
  );
}

function ProjectCard({
  project,
  index,
  onDelete,
}: {
  project: Project;
  index: number;
  onDelete: () => void;
}) {
  const created = new Date(project.created_at);
  const dateStr = `${created.getFullYear()}.${String(created.getMonth() + 1).padStart(2, "0")}.${String(created.getDate()).padStart(2, "0")}`;
  const isRunning = project.status === "processing";

  return (
    <li
      className="reveal glass-card overflow-hidden p-0"
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      {/* index strip */}
      <div className="flex items-center justify-between px-3 h-7 border-b border-border bg-secondary/30 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
        <span>NO. {String(project.id).padStart(4, "0")}</span>
        <StatusBadge status={project.status} />
      </div>

      <Link href={`/projects/${project.id}`} className="block">
        {/* cover */}
        <div className="relative aspect-[4/5] bg-muted/40 overflow-hidden border-b border-border">
          {project.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.cover_url}
              alt={project.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-muted-foreground scanline">
              <div className="flex flex-col items-center gap-2">
                <ImageOff className="w-5 h-5" />
                <span className="font-mono text-[10px] tracking-wider uppercase">
                  无封面 · NO COVER
                </span>
              </div>
            </div>
          )}

          {isRunning && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-3 left-3 right-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-signal">
                <span className="w-1.5 h-1.5 bg-signal rounded-full pulse-dot" />
                RECORDING ·
                <span className="ml-auto opacity-70">流水线运行中</span>
              </div>
              <div className="absolute -bottom-px left-0 right-0 h-px overflow-hidden">
                <div className="h-full w-1/3 bg-signal animate-[ticker_1.6s_linear_infinite]" />
              </div>
            </div>
          )}

          <span
            className="absolute bottom-3 right-3 text-[10px] font-mono tracking-[0.25em] uppercase text-foreground/70 glass px-2 py-1 rounded-md"
            aria-hidden
          >
            {dateStr}
          </span>
        </div>

        <div className="p-4 space-y-1.5">
          <h3
            className="text-lg leading-tight tracking-wide text-foreground line-clamp-2"
            style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
          >
            {project.name}
          </h3>
          {project.product_title && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              ▸ {project.product_title}
            </p>
          )}
        </div>
      </Link>

      <div className="flex items-center justify-between px-3 h-9 border-t border-border bg-secondary/20">
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-signal transition-colors"
        >
          打开工程
          <ArrowUpRight className="w-3 h-3" />
        </Link>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm(`确认删除「${project.name}」?此操作不可撤销。`)) {
              onDelete();
            }
          }}
          className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          删除
        </button>
      </div>
    </li>
  );
}

function ProjectGridSkeleton() {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <li
          key={i}
          className="border border-border bg-card animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="h-7 border-b border-border bg-secondary/30" />
          <div className="aspect-[4/5] scanline bg-muted/40" />
          <div className="p-4 space-y-2">
            <div className="h-4 w-3/4 bg-muted rounded-sm" />
            <div className="h-3 w-1/2 bg-muted/60 rounded-sm" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ onCreate, hasProjects }: { onCreate: () => void; hasProjects: boolean }) {
  return (
    <div className="glass-card py-20 px-6 text-center rounded-2xl">
      <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-secondary/60 grid place-items-center">
        <span className="text-2xl">📭</span>
      </div>
      <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-signal mb-3">
        EMPTY · 空空如也
      </p>
      <h2
        className="text-2xl text-foreground mb-2"
        style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
      >
        {hasProjects ? "没有匹配的项目" : "还没有任何项目"}
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
        {hasProjects
          ? "试试调整筛选条件,或者创建一个新的视频工程。"
          : "上传一张商品图,系统会用大约 4 分钟交付一支可发布的短视频。"}
      </p>
      <Button
        onClick={onCreate}
        className="bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs tracking-[0.2em] uppercase gap-2 shadow-glow"
      >
        <Plus className="w-3.5 h-3.5" />
        创建第一个项目
      </Button>
    </div>
  );
}
