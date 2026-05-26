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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function CreateProjectDialog() {
  const router = useRouter();
  const isOpen = useUIStore((s) => s.isCreateDialogOpen);
  const closeDialog = useUIStore((s) => s.closeCreateDialog);
  const createProject = useProjectStore((s) => s.createProject);
  const [name, setName] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const project = await createProject(name, productTitle, productDescription);
      toast.success("项目已创建");
      setName("");
      setProductTitle("");
      setProductDescription("");
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
              空白画布。<br />从一个节点开始构建。
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground tracking-wide">
              新建后进入空画布,在画布上右键即可创建文本/图片/视频节点,自由编排你的工作流。
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

          <Field label="项目描述" hint="OPTIONAL">
            <Textarea
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="可以记录这个项目的背景、风格基调等,后续可在节点中引用。"
              rows={3}
            />
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
