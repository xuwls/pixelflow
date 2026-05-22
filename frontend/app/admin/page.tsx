"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { ProviderDialog } from "@/components/admin/provider-dialog";
import { ModelDialog } from "@/components/admin/model-dialog";
import {
  deleteAdminModel,
  deleteProvider,
  updateAdminModel,
  updateProvider,
} from "@/lib/api/admin";
import {
  CAPABILITIES,
  type ModelResponse,
  type ProviderResponse,
} from "@/lib/types/admin";
import {
  CAPABILITY_LABELS,
  type Capability,
} from "@/lib/types/capability";
import { useAdminStore } from "@/lib/store/admin-store";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  Power,
  PowerOff,
  AlertCircle,
} from "lucide-react";

export default function AdminPage() {
  const providers = useAdminStore((s) => s.providers);
  const models = useAdminStore((s) => s.models);
  const loading = useAdminStore((s) => s.loading);
  const error = useAdminStore((s) => s.error);
  const refresh = useAdminStore((s) => s.refresh);
  const setProviders = useAdminStore((s) => s.setProviders);
  const setModels = useAdminStore((s) => s.setModels);

  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] =
    useState<ProviderResponse | null>(null);

  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelResponse | null>(null);

  const [capabilityFilter, setCapabilityFilter] = useState<Capability | "all">(
    "all",
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const total = models.length;
    const byCap: Record<string, number> = {};
    for (const m of models) {
      byCap[m.capability] = (byCap[m.capability] ?? 0) + 1;
    }
    return { total, byCap };
  }, [models]);

  const filteredModels = useMemo(() => {
    if (capabilityFilter === "all") return models;
    return models.filter((m) => m.capability === capabilityFilter);
  }, [models, capabilityFilter]);

  const groupedModels = useMemo(() => {
    const groups = new Map<Capability, ModelResponse[]>();
    for (const cap of CAPABILITIES) groups.set(cap, []);
    for (const m of filteredModels) {
      groups.get(m.capability)?.push(m);
    }
    for (const [, list] of groups) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    }
    return groups;
  }, [filteredModels]);

  const handleProviderSaved = (next: ProviderResponse) => {
    const idx = providers.findIndex((p) => p.id === next.id);
    if (idx === -1) {
      setProviders([...providers, next]);
    } else {
      const copy = [...providers];
      copy[idx] = next;
      setProviders(copy);
    }
  };

  const handleModelSaved = (next: ModelResponse) => {
    // is_default 切换会影响其它行,直接重新拉取
    if (next.is_default) {
      void refresh();
      return;
    }
    const idx = models.findIndex((m) => m.id === next.id);
    if (idx === -1) {
      setModels([...models, next]);
    } else {
      const copy = [...models];
      copy[idx] = next;
      setModels(copy);
    }
  };

  const handleDeleteProvider = async (p: ProviderResponse) => {
    const linked = models.filter((m) => m.provider_id === p.id).length;
    const msg =
      linked > 0
        ? `确认删除供应商「${p.display_name}」?其下还有 ${linked} 个模型,会一并删除。`
        : `确认删除供应商「${p.display_name}」?`;
    if (!confirm(msg)) return;
    try {
      await deleteProvider(p.id);
      toast.success("供应商已删除");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handleToggleProvider = async (p: ProviderResponse) => {
    try {
      const next = await updateProvider(p.id, { enabled: !p.enabled });
      handleProviderSaved(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  };

  const handleDeleteModel = async (m: ModelResponse) => {
    if (!confirm(`确认删除模型「${m.display_name}」?`)) return;
    try {
      await deleteAdminModel(m.id);
      toast.success("模型已删除");
      setModels(models.filter((x) => x.id !== m.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handleToggleModel = async (m: ModelResponse) => {
    try {
      const next = await updateAdminModel(m.id, { enabled: !m.enabled });
      handleModelSaved(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  };

  const handleSetDefault = async (m: ModelResponse) => {
    try {
      await updateAdminModel(m.id, { is_default: true });
      toast.success("已设为默认");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  };

  return (
    <div className="min-h-screen relative grain">
      <SiteHeader />

      <ProviderDialog
        open={providerDialogOpen}
        onOpenChange={(open) => {
          setProviderDialogOpen(open);
          if (!open) setEditingProvider(null);
        }}
        provider={editingProvider}
        onSaved={handleProviderSaved}
      />

      <ModelDialog
        open={modelDialogOpen}
        onOpenChange={(open) => {
          setModelDialogOpen(open);
          if (!open) setEditingModel(null);
        }}
        model={editingModel}
        providers={providers}
        onSaved={handleModelSaved}
      />

      {/* Page banner */}
      <section className="border-b border-border bg-hairline">
        <div className="mx-auto max-w-[1600px] px-6 py-12 grid grid-cols-12 gap-6 items-end">
          <div className="col-span-12 md:col-span-8 reveal reveal-1">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-signal mb-3">
              § Admin · 模型管理
            </p>
            <h1
              className="text-4xl md:text-6xl leading-[0.95] tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}
            >
              AI<span className="text-signal">.</span>注册表
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-xl">
              在这里维护 AI 供应商与模型清单。改动会即时生效到下一次工作流执行,API
              Key 仅存储在服务器并由后端调用。
            </p>
          </div>
          <div className="col-span-12 md:col-span-4 reveal reveal-2">
            <dl className="grid grid-cols-3 gap-px bg-border border border-border">
              <Stat label="供应商" value={providers.length} />
              <Stat
                label="启用"
                value={providers.filter((p) => p.enabled).length}
                accent
              />
              <Stat label="模型总数" value={counts.total} />
            </dl>
          </div>
        </div>
      </section>

      {error && (
        <section className="mx-auto max-w-[1600px] px-6 pt-6">
          <div className="flex items-center gap-2 px-3 py-2 border border-destructive/40 bg-destructive/10 text-destructive text-xs font-mono">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </section>
      )}

      {/* Providers */}
      <section className="mx-auto max-w-[1600px] px-6 pt-10 pb-4">
        <SectionHeader
          eyebrow="01 · PROVIDERS"
          title="供应商"
          subtitle={`${providers.length} 条记录,API Key 在 GET 响应中始终被遮蔽。`}
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditingProvider(null);
                setProviderDialogOpen(true);
              }}
              className="bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs tracking-wider gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              新增供应商
            </Button>
          }
        />

        {loading ? (
          <TableSkeleton rows={3} />
        ) : providers.length === 0 ? (
          <EmptyHint text="还没有供应商,先添加一个再录入模型。" />
        ) : (
          <div className="border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/30 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                <tr>
                  <Th>NO.</Th>
                  <Th>内部标识</Th>
                  <Th>展示名称</Th>
                  <Th>API KEY</Th>
                  <Th>BASE URL</Th>
                  <Th>状态</Th>
                  <Th className="text-right pr-3">操作</Th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-b-0 hover:bg-secondary/20 transition-colors"
                  >
                    <Td className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {String(p.id).padStart(3, "0")}
                    </Td>
                    <Td className="font-mono text-xs">{p.name}</Td>
                    <Td>
                      <div className="text-foreground">{p.display_name}</div>
                      {p.description && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {p.description}
                        </div>
                      )}
                    </Td>
                    <Td className="font-mono text-xs">
                      {p.has_api_key ? (
                        <span className="text-foreground/80">
                          {p.api_key_masked}
                        </span>
                      ) : (
                        <span className="text-destructive/80">未设置</span>
                      )}
                    </Td>
                    <Td className="font-mono text-[11px] text-muted-foreground max-w-[260px] truncate">
                      {p.base_url || "—"}
                    </Td>
                    <Td>
                      {p.enabled ? (
                        <Badge tone="signal">ENABLED</Badge>
                      ) : (
                        <Badge tone="muted">DISABLED</Badge>
                      )}
                    </Td>
                    <Td className="text-right pr-3">
                      <RowActions>
                        <RowAction
                          onClick={() => handleToggleProvider(p)}
                          title={p.enabled ? "停用" : "启用"}
                        >
                          {p.enabled ? (
                            <PowerOff className="w-3.5 h-3.5" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                        </RowAction>
                        <RowAction
                          onClick={() => {
                            setEditingProvider(p);
                            setProviderDialogOpen(true);
                          }}
                          title="编辑"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </RowAction>
                        <RowAction
                          onClick={() => handleDeleteProvider(p)}
                          title="删除"
                          danger
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </RowAction>
                      </RowActions>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Models */}
      <section className="mx-auto max-w-[1600px] px-6 pt-8 pb-16">
        <SectionHeader
          eyebrow="02 · MODELS"
          title="模型"
          subtitle="按 capability 分组。每个 capability 至多保留一个默认。"
          action={
            <Button
              size="sm"
              onClick={() => {
                if (providers.length === 0) {
                  toast.error("请先添加供应商");
                  return;
                }
                setEditingModel(null);
                setModelDialogOpen(true);
              }}
              className="bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs tracking-wider gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              新增模型
            </Button>
          }
        />

        <div className="flex flex-wrap items-center gap-1 mb-4 font-mono text-[10px] tracking-[0.2em] uppercase">
          <FilterPill
            active={capabilityFilter === "all"}
            onClick={() => setCapabilityFilter("all")}
            count={counts.total}
          >
            全部
          </FilterPill>
          {CAPABILITIES.map((cap) => (
            <FilterPill
              key={cap}
              active={capabilityFilter === cap}
              onClick={() => setCapabilityFilter(cap)}
              count={counts.byCap[cap] ?? 0}
            >
              {cap.toUpperCase()}
            </FilterPill>
          ))}
        </div>

        {loading ? (
          <TableSkeleton rows={5} />
        ) : models.length === 0 ? (
          <EmptyHint text="还没有模型记录。点击右上角「新增模型」开始。" />
        ) : (
          <div className="space-y-6">
            {Array.from(groupedModels.entries())
              .filter(([, list]) => list.length > 0)
              .map(([cap, list]) => (
                <div key={cap}>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-signal">
                      ⌁ {cap.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {CAPABILITY_LABELS[cap]}
                    </span>
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {list.length} 个
                    </span>
                  </div>
                  <div className="border border-border bg-card overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-secondary/30 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                        <tr>
                          <Th>NO.</Th>
                          <Th>展示名称</Th>
                          <Th>model_name</Th>
                          <Th>供应商</Th>
                          <Th>默认参数</Th>
                          <Th>状态</Th>
                          <Th className="text-right pr-3">操作</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((m) => (
                          <tr
                            key={m.id}
                            className="border-b border-border last:border-b-0 hover:bg-secondary/20 transition-colors"
                          >
                            <Td className="font-mono text-[11px] text-muted-foreground tabular-nums">
                              {String(m.id).padStart(3, "0")}
                            </Td>
                            <Td>
                              <div className="flex items-center gap-1.5">
                                <span className="text-foreground">
                                  {m.display_name}
                                </span>
                                {m.is_default && (
                                  <Star className="w-3 h-3 fill-signal text-signal" />
                                )}
                              </div>
                              {m.description && (
                                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                  {m.description}
                                </div>
                              )}
                            </Td>
                            <Td className="font-mono text-xs">{m.model_name}</Td>
                            <Td className="text-xs">{m.provider_name}</Td>
                            <Td className="font-mono text-[11px] text-muted-foreground max-w-[240px]">
                              <span className="truncate inline-block max-w-full">
                                {Object.keys(m.default_params || {}).length === 0
                                  ? "—"
                                  : JSON.stringify(m.default_params)}
                              </span>
                            </Td>
                            <Td>
                              {m.enabled ? (
                                <Badge tone="signal">ENABLED</Badge>
                              ) : (
                                <Badge tone="muted">DISABLED</Badge>
                              )}
                            </Td>
                            <Td className="text-right pr-3">
                              <RowActions>
                                {!m.is_default && (
                                  <RowAction
                                    onClick={() => handleSetDefault(m)}
                                    title="设为默认"
                                  >
                                    <Star className="w-3.5 h-3.5" />
                                  </RowAction>
                                )}
                                <RowAction
                                  onClick={() => handleToggleModel(m)}
                                  title={m.enabled ? "停用" : "启用"}
                                >
                                  {m.enabled ? (
                                    <PowerOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Power className="w-3.5 h-3.5" />
                                  )}
                                </RowAction>
                                <RowAction
                                  onClick={() => {
                                    setEditingModel(m);
                                    setModelDialogOpen(true);
                                  }}
                                  title="编辑"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </RowAction>
                                <RowAction
                                  onClick={() => handleDeleteModel(m)}
                                  title="删除"
                                  danger
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </RowAction>
                              </RowActions>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-background px-4 py-4">
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1">
        {label}
      </p>
      <p
        className={`text-3xl leading-none tabular-nums ${
          accent ? "text-signal" : "text-foreground"
        }`}
        style={{ fontFamily: "var(--font-display-en)", fontWeight: 600 }}
      >
        {String(value).padStart(2, "0")}
      </p>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
      <div>
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-signal mb-1">
          {eyebrow}
        </p>
        <h2
          className="text-2xl text-foreground"
          style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-2.5 rounded-sm border transition-colors ${
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      <span className="ml-1.5 opacity-60 tabular-nums">{count}</span>
    </button>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`text-left font-normal px-3 py-2 ${className ?? ""}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 align-middle ${className ?? ""}`}>{children}</td>;
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "signal" | "muted";
}) {
  return (
    <span
      className={`inline-flex items-center px-1.5 h-5 font-mono text-[10px] tracking-[0.2em] rounded-sm border ${
        tone === "signal"
          ? "border-signal/40 text-signal bg-signal/5"
          : "border-border text-muted-foreground bg-muted/30"
      }`}
    >
      {children}
    </span>
  );
}

function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="inline-flex items-center gap-0.5">{children}</div>;
}

function RowAction({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-sm border border-transparent hover:border-border transition-colors ${
        danger
          ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="border border-dashed border-border py-12 px-6 text-center bg-hairline">
      <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
        {text}
      </p>
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="border border-border bg-card">
      <div className="h-9 border-b border-border bg-secondary/30" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 border-b border-border last:border-b-0 animate-pulse bg-muted/20"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}
