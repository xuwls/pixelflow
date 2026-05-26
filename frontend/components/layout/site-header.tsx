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
    <header className="sticky top-0 z-50">
      {/* gradient fade background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background/60 backdrop-blur-xl" />
      {/* bottom glow bar */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-signal/20 to-transparent" />

      <div className="relative mx-auto px-8 h-16 flex items-center justify-between max-w-[1600px]">
        <Link href="/" className="flex items-baseline gap-3 group shrink-0">
          <span className="text-[10px] font-mono tracking-[0.35em] text-muted-foreground group-hover:text-signal transition-colors duration-300">
            PX/FLOW
          </span>
          <span
            className="text-2xl leading-none tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display-en)", fontWeight: 600, fontVariationSettings: "'opsz' 144, 'SOFT' 50" }}
          >
            像素流<span className="text-signal">.</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink href="/projects">项目库</NavLink>
          <NavLink href="/admin">模型</NavLink>

          <span className="w-px h-5 bg-border/60 mx-3" />

          <Button
            variant={debugMode ? "default" : "ghost"}
            size="sm"
            onClick={toggleDebugMode}
            className="gap-1.5 font-mono text-[11px] tracking-wider text-muted-foreground hover:text-foreground"
          >
            <Bug className="w-3.5 h-3.5" />
            调试
          </Button>

          <StopAllButton />

          <Button
            size="sm"
            onClick={openCreateDialog}
            className="bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-[11px] tracking-wider gap-1.5 shadow-glow ml-2"
          >
            <Plus className="w-3.5 h-3.5" />
            新建项目
          </Button>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative px-3 py-2 text-[11px] font-mono tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors duration-200 group"
    >
      {children}
      <span className="absolute bottom-1 left-3 right-3 h-px bg-signal scale-x-0 group-hover:scale-x-100 transition-transform duration-250 ease-out origin-left" />
    </Link>
  );
}
