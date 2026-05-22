import { cn } from "@/lib/utils";

const statusConfig: Record<
  string,
  { label: string; bg: string; fg: string; dot: string; pulse?: boolean }
> = {
  pending:    { label: "待运行", bg: "bg-transparent",          fg: "text-muted-foreground", dot: "bg-muted-foreground/60" },
  running:    { label: "运行中", bg: "bg-signal/15",            fg: "text-signal",           dot: "bg-signal",            pulse: true },
  completed:  { label: "完成",   bg: "bg-foreground/10",        fg: "text-foreground",       dot: "bg-foreground" },
  failed:     { label: "失败",   bg: "bg-destructive/15",       fg: "text-destructive",      dot: "bg-destructive" },
  skipped:    { label: "跳过",   bg: "bg-transparent",          fg: "text-muted-foreground", dot: "bg-muted-foreground/40" },
  cancelled:  { label: "已取消", bg: "bg-warn/15",              fg: "text-warn",             dot: "bg-warn" },
  draft:      { label: "草稿",   bg: "bg-transparent",          fg: "text-muted-foreground", dot: "bg-muted-foreground/60" },
  processing: { label: "运行中", bg: "bg-signal/15",            fg: "text-signal",           dot: "bg-signal",            pulse: true },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = statusConfig[status] || { label: status, bg: "bg-transparent", fg: "text-muted-foreground", dot: "bg-muted-foreground/60" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm border border-border/60 font-mono text-[10px] tracking-[0.15em] uppercase leading-none",
        cfg.bg,
        cfg.fg,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot, cfg.pulse && "pulse-dot")} />
      {cfg.label}
    </span>
  );
}
