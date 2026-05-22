"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useUIStore } from "@/lib/store/ui-store";
import { useProjectStore } from "@/lib/store/project-store";
import { uploadProductImage } from "@/lib/api/projects";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";

export function CreateProjectDialog() {
  const router = useRouter();
  const isOpen = useUIStore((s) => s.isCreateDialogOpen);
  const closeDialog = useUIStore((s) => s.closeCreateDialog);
  const createProject = useProjectStore((s) => s.createProject);
  const [name, setName] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const project = await createProject(name, productTitle, productDescription);
      if (file) {
        await uploadProductImage(project.id, file);
      }
      toast.success("项目已创建");
      setName("");
      setProductTitle("");
      setProductDescription("");
      setFile(null);
      closeDialog();
      router.push(`/projects/${project.id}`);
    } catch {
      toast.error("创建失败,请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-lg bg-card border border-border rounded-md p-0 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-border bg-gradient-to-b from-secondary/40 to-transparent">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-signal mb-2">
            ◉ NEW · 新建工程
          </p>
          <DialogHeader className="space-y-1.5">
            <DialogTitle
              className="text-2xl leading-tight text-foreground"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
            >
              一张商品图。<br />一段会卖货的视频。
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground tracking-wide">
              填写商品信息后,流水线将自动开始执行。整个过程通常在 3 至 5 分钟内完成。
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4">
          <Field label="项目名称" hint="REQUIRED">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如:夏日防晒霜 · 短视频投放"
            />
          </Field>

          <Field label="商品标题" hint="OPTIONAL">
            <Input
              value={productTitle}
              onChange={(e) => setProductTitle(e.target.value)}
              placeholder="例如:轻盈水感防晒乳 SPF50+"
            />
          </Field>

          <Field label="商品卖点 / 描述" hint="OPTIONAL">
            <Textarea
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="一句话也可以。AI 会自动补全场景与文案。"
              rows={3}
            />
          </Field>

          <Field label="商品图" hint="OPTIONAL">
            <label className="group relative block border border-dashed border-border hover:border-signal/60 rounded-md cursor-pointer transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="flex items-center gap-3 px-3 py-3">
                <div className="w-10 h-10 rounded-sm border border-border bg-muted/50 grid place-items-center group-hover:border-signal/60 transition-colors">
                  <ImagePlus className="w-4 h-4 text-muted-foreground group-hover:text-signal transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate text-foreground">
                    {file ? file.name : "点击上传或拖拽图片"}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {file ? `${(file.size / 1024).toFixed(0)} KB` : "JPG / PNG / WEBP · ≤ 10MB"}
                  </div>
                </div>
              </div>
            </label>
          </Field>
        </div>

        <div className="px-6 py-4 border-t border-border bg-secondary/30 flex items-center justify-between gap-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            按 ⏎ 立即开始
          </p>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs tracking-wider gap-2 px-4"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                创建中…
              </>
            ) : (
              <>开始 → CREATE</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
