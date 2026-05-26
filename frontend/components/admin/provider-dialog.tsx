"use client";

import { useState } from "react";
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
  createProvider,
  updateProvider,
} from "@/lib/api/admin";
import type {
  ProviderCreate,
  ProviderResponse,
  ProviderUpdate,
} from "@/lib/types/admin";
import { ApiError } from "@/lib/api/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode; provider object = edit mode */
  provider: ProviderResponse | null;
  onSaved: (next: ProviderResponse) => void;
}

export function ProviderDialog({ open, onOpenChange, provider, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg !rounded-2xl p-0 overflow-hidden">
        {open && (
          <ProviderForm
            key={provider?.id ?? "new"}
            provider={provider}
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

function ProviderForm({
  provider,
  onCancel,
  onSaved,
}: {
  provider: ProviderResponse | null;
  onCancel: () => void;
  onSaved: (next: ProviderResponse) => void;
}) {
  const isEdit = provider !== null;
  const [name, setName] = useState(provider?.name ?? "");
  const [displayName, setDisplayName] = useState(provider?.display_name ?? "");
  const [apiKey, setApiKey] = useState("");
  const [rotateKey, setRotateKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(provider?.base_url ?? "");
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [description, setDescription] = useState(provider?.description ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!displayName.trim()) {
      toast.error("展示名称不能为空");
      return;
    }
    if (!isEdit && !name.trim()) {
      toast.error("内部标识不能为空");
      return;
    }

    setSubmitting(true);
    try {
      let result: ProviderResponse;
      if (isEdit && provider) {
        const payload: ProviderUpdate = {
          display_name: displayName.trim(),
          base_url: baseUrl.trim() || null,
          enabled,
          description: description.trim() || null,
        };
        if (rotateKey) {
          payload.api_key = apiKey;
        }
        result = await updateProvider(provider.id, payload);
        toast.success("已更新");
      } else {
        const payload: ProviderCreate = {
          name: name.trim(),
          display_name: displayName.trim(),
          api_key: apiKey,
          base_url: baseUrl.trim() || null,
          enabled,
          description: description.trim() || null,
        };
        result = await createProvider(payload);
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
          {isEdit ? "◉ EDIT · 编辑供应商" : "◉ NEW · 新增供应商"}
        </p>
        <DialogHeader className="space-y-1.5">
          <DialogTitle
            className="text-xl leading-tight text-foreground"
            style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
          >
            {isEdit ? provider?.display_name : "新的 AI 供应商"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground tracking-wide">
            API Key 仅在服务器侧调用接口时使用,不会下发到浏览器。
          </DialogDescription>
        </DialogHeader>
      </div>

      <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
        <Field label="内部标识" hint={isEdit ? "READONLY" : "REQUIRED"}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isEdit}
            placeholder="如 qwen_vl,代码与 model_registry 引用"
          />
        </Field>

        <Field label="展示名称" hint="REQUIRED">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="如 通义千问 VL"
          />
        </Field>

        <Field
          label="API KEY"
          hint={
            isEdit
              ? provider?.has_api_key
                ? `当前: ${provider.api_key_masked}`
                : "未设置"
              : "存储为明文"
          }
        >
          {isEdit && !rotateKey ? (
            <button
              type="button"
              onClick={() => setRotateKey(true)}
              className="w-full text-left h-8 px-2.5 border border-dashed border-border rounded-lg text-xs font-mono uppercase tracking-wider text-muted-foreground hover:border-signal hover:text-signal transition-colors"
            >
              ↻ 点击轮换 API Key
            </button>
          ) : (
            <div className="space-y-1.5">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-…"
                autoComplete="off"
              />
              {isEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setRotateKey(false);
                    setApiKey("");
                  }}
                  className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                >
                  取消轮换
                </button>
              )}
            </div>
          )}
        </Field>

        <Field label="BASE URL" hint="OPTIONAL">
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="如 https://dashscope.aliyuncs.com/compatible-mode/v1"
          />
        </Field>

        <Field label="备注" hint="OPTIONAL">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="一句话说明用途"
            rows={2}
          />
        </Field>

        <label className="flex items-center justify-between gap-3 px-3 h-10 border border-border rounded-md bg-background/40 cursor-pointer">
          <div>
            <div className="text-xs text-foreground tracking-wide">
              启用该供应商
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              {enabled ? "ENABLED · 调用可见" : "DISABLED · 工作流不会再使用"}
            </div>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-signal"
          />
        </label>
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
          disabled={submitting}
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
