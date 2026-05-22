"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StopAllButton } from "@/components/workflow/stop-all-button";
import { useUIStore } from "@/lib/store/ui-store";
import { Bug, Plus } from "lucide-react";

export function SiteHeader() {
  const openCreateDialog = useUIStore((s) => s.openCreateDialog);
  const debugMode = useUIStore((s) => s.debugMode);
  const toggleDebugMode = useUIStore((s) => s.toggleDebugMode);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="mx-auto px-6 h-14 flex items-center justify-between max-w-[1600px]">
        <Link href="/" className="flex items-baseline gap-3 group">
          <span className="text-xs font-mono tracking-[0.3em] text-muted-foreground group-hover:text-signal transition-colors">
            PX/FLOW
          </span>
          <span
            className="text-2xl leading-none tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display-en)", fontWeight: 600, fontVariationSettings: "'opsz' 144, 'SOFT' 50" }}
          >
            像素流<span className="text-signal">.</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1.5">
          <Link
            href="/projects"
            className="px-3 py-1.5 text-xs font-mono tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            项目库 / Library
          </Link>
          <Link
            href="/admin"
            className="px-3 py-1.5 text-xs font-mono tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            模型 / Admin
          </Link>
          <span className="w-px h-4 bg-border mx-2" />
          <Button
            variant={debugMode ? "default" : "outline"}
            size="sm"
            onClick={toggleDebugMode}
            className="gap-1.5 font-mono text-xs tracking-wider"
          >
            <Bug className="w-3.5 h-3.5" />
            调试
          </Button>
          <StopAllButton />
          <Button
            size="sm"
            onClick={openCreateDialog}
            className="bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs tracking-wider gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            新建项目
          </Button>
        </nav>
      </div>
    </header>
  );
}
