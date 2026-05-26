"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAdminModel, updateAdminModel } from "@/lib/api/admin";
import {
  CAPABILITIES,
  type ModelCreate,
  type ModelResponse,
  type ModelUpdate,
  type ProviderResponse,
} from "@/lib/types/admin";
import {
  CAPABILITY_LABELS,
  type Capability,
} from "@/lib/types/capability";
import { ApiError } from "@/lib/api/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode; model object = edit mode */
  model: ModelResponse | null;
  providers: ProviderResponse[];
  onSaved: (next: ModelResponse) => void;
}

export function ModelDialog({
  open,
  onOpenChange,
  model,
  providers,
  onSaved,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl !rounded-2xl p-0 overflow-hidden">
        {open && (
          <ModelForm
            key={model?.id ?? "new"}
            model={model}
            providers={providers}
            onCancel={() => onOpenChange(false)}
            onSaved={(next) => {
              onSaved(next);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModelForm({
  model,
  providers,
  onCancel,
  onSaved,
}: {
  model: ModelResponse | null;
  providers: ProviderResponse[];
  onCancel: () => void;
  onSaved: (next: ModelResponse) => void;
}) {
  const isEdit = model !== null;

  const [providerId, setProviderId] = useState<number | null>(
    model?.provider_id ?? providers[0]?.id ?? null,
  );
  const [capability, setCapability] = useState<Capability>(
    model?.capability ?? "文字编辑/生成",
  );
  const [modelName, setModelName] = useState(model?.model_name ?? "");
  const [displayName, setDisplayName] = useState(model?.display_name ?? "");
  const [isDefault, setIsDefault] = useState(model?.is_default ?? false);
  const [enabled, setEnabled] = useState(model?.enabled ?? true);
  const [sortOrder, setSortOrder] = useState(model?.sort_order ?? 0);
  const [description, setDescription] = useState(model?.description ?? "");
  const [paramsJson, setParamsJson] = useState(
    JSON.stringify(model?.default_params ?? {}, null, 2),
  );
  const [submitting, setSubmitting] = useState(false);

  const paramsError = useMemo(() => {
    if (!paramsJson.trim()) return null;
    try {
      const parsed = JSON.parse(paramsJson);
      if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
        return "必须是 JSON 对象";
      }
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "JSON 格式错误";
    }
  }, [paramsJson]);

  const handleSubmit = async () => {
    if (!isEdit && providerId === null) {
      toast.error("请选择供应商");
      return;
    }
    if (!modelName.trim() || !displayName.trim()) {
      toast.error("模型标识和展示名称不能为空");
      return;
    }
    if (paramsError) {
      toast.error(`默认参数: ${paramsError}`);
      return;
    }

    const default_params = paramsJson.trim()
      ? (JSON.parse(paramsJson) as Record<string, unknown>)
      : {};

    setSubmitting(true);
    try {
      let result: ModelResponse;
      if (isEdit && model) {
        const payload: ModelUpdate = {
          capability,
          model_name: modelName.trim(),
          display_name: displayName.trim(),
          is_default: isDefault,
          default_params,
          enabled,
          sort_order: sortOrder,
          description: description.trim() || null,
        };
        result = await updateAdminModel(model.id, payload);
        toast.success("已更新");
      } else {
        const payload: ModelCreate = {
          provider_id: providerId!,
          capability,
          model_name: modelName.trim(),
          display_name: displayName.trim(),
          is_default: isDefault,
          default_params,
          enabled,
          sort_order: sortOrder,
          description: description.trim() || null,
        };
        result = await createAdminModel(payload);
        toast.success("已创建");
      }
      onSaved(result);
    } catch (err) {
      const msg =
        err instanceof ApiError ? String(err.message) : "操作失败,请稍后重试";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="px-6 pt-5 pb-4 border-b border-border bg-gradient-to-b from-secondary/40 to-transparent">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-signal mb-2">
          {isEdit ? "◉ EDIT · 编辑模型" : "◉ NEW · 新增模型"}
        </p>
        <DialogHeader className="space-y-1.5">
          <DialogTitle
            className="text-xl leading-tight text-foreground"
            style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
          >
            {isEdit ? model?.display_name : "新的 AI 模型"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground tracking-wide">
            将该模型挂载到指定 capability,工作流即可在节点选项里使用。
          </DialogDescription>
        </DialogHeader>
      </div>

      <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <Field label="供应商" hint={isEdit ? "READONLY" : "REQUIRED"}>
            {isEdit ? (
              <Input
                value={model?.provider_name ?? ""}
                disabled
                className="font-mono text-xs"
              />
            ) : (
              <Select
                value={providerId !== null ? String(providerId) : undefined}
                onValueChange={(v) => {
                  if (v) setProviderId(Number(v));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择供应商" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.display_name}
                      {!p.enabled && (
                        <span className="ml-2 text-[10px] font-mono uppercase text-muted-foreground">
                          (DISABLED)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field label="CAPABILITY" hint="REQUIRED">
            <Select
              value={capability}
              onValueChange={(v) => {
                if (v) setCapability(v as Capability);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAPABILITIES.map((cap) => (
                  <SelectItem key={cap} value={cap}>
                    {CAPABILITY_LABELS[cap]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="模型标识 (model_name)" hint="REQUIRED">
          <Input
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="如 qwen-vl-max-latest"
            className="font-mono"
          />
        </Field>

        <Field label="展示名称" hint="REQUIRED">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="如 千问 VL · Max"
          />
        </Field>

        <Field
          label="默认参数 (JSON)"
          hint={paramsError ? "INVALID" : "OPTIONAL"}
        >
          <Textarea
            value={paramsJson}
            onChange={(e) => setParamsJson(e.target.value)}
            rows={5}
            className={
              paramsError
                ? "font-mono text-xs border-destructive focus-visible:border-destructive"
                : "font-mono text-xs"
            }
            placeholder='{"size": "1024*1024"}'
          />
          {paramsError && (
            <p className="text-[10px] font-mono text-destructive">
              {paramsError}
            </p>
          )}
        </Field>

        <Field label="备注" hint="OPTIONAL">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="一句话说明该模型的用途"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="排序权重" hint="数字越小越靠前">
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </Field>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-foreground tracking-wide">状态</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 h-7 px-2.5 border border-border rounded-md cursor-pointer hover:border-signal/60 transition-colors">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-3.5 h-3.5 accent-signal"
                />
                <span className="text-xs">作为该 capability 的默认</span>
              </label>
              <label className="flex items-center gap-2 h-7 px-2.5 border border-border rounded-md cursor-pointer hover:border-signal/60 transition-colors">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 accent-signal"
                />
                <span className="text-xs">启用</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-border bg-secondary/30 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
          className="font-mono text-xs tracking-wider"
        >
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || !!paramsError}
          size="sm"
          className="bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs tracking-wider gap-1.5"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              保存中…
            </>
          ) : isEdit ? (
            "保存修改"
          ) : (
            "创建"
          )}
        </Button>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-foreground tracking-wide">{label}</span>
        {hint && (
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
