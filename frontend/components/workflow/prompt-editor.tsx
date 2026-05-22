"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generatePrompt } from "@/lib/api/models";
import { toast } from "sonner";
import { Sparkles, RotateCcw } from "lucide-react";

interface PromptEditorProps {
  projectId: number;
  nodeId: number;
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  defaultPlaceholder: string;
}

export function PromptEditor({
  projectId,
  nodeId,
  value,
  onChange,
  onSave,
  defaultPlaceholder,
}: PromptEditorProps) {
  const [generating, setGenerating] = useState(false);
  const [extraInstruction, setExtraInstruction] = useState("");
  const [showExtra, setShowExtra] = useState(false);

  const isCustom = value.trim().length > 0;

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await generatePrompt(projectId, nodeId, {
        extra_instruction: extraInstruction.trim() || undefined,
      });
      onChange(res.user_prompt);
      toast.success("Prompt 已生成,记得点击保存");
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败";
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  function handleReset() {
    onChange("");
    onSave();
    toast.success("已恢复默认 Prompt");
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-mono tracking-wider uppercase text-muted-foreground">
          USER PROMPT
        </Label>
        <span
          className={`font-mono text-[10px] tracking-wider uppercase ${
            isCustom ? "text-signal" : "text-muted-foreground"
          }`}
        >
          {isCustom ? "CUSTOM" : "DEFAULT"}
        </span>
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        placeholder={defaultPlaceholder}
        rows={10}
        className="font-mono text-[11.5px] leading-relaxed resize-y min-h-[180px] bg-background"
      />

      {showExtra && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-mono tracking-wider uppercase text-muted-foreground">
            ADDITIONAL INSTRUCTION
          </Label>
          <Textarea
            value={extraInstruction}
            onChange={(e) => setExtraInstruction(e.target.value)}
            placeholder="可选 — 给一键生成额外的指令,例如「更口语化」、「加强卖点」"
            rows={2}
            className="text-xs resize-y bg-background"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1 font-mono text-xs tracking-wider gap-2"
          onClick={handleGenerate}
          disabled={generating}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {generating ? "GENERATING…" : "一键生成 · AUTO"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="font-mono text-[10px] tracking-wider"
          onClick={() => setShowExtra((s) => !s)}
          title="切换额外指令输入"
        >
          {showExtra ? "−" : "+"}
        </Button>
        {isCustom && (
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-[10px] tracking-wider gap-1.5"
            onClick={handleReset}
            title="恢复默认 Prompt"
          >
            <RotateCcw className="w-3 h-3" />
            RESET
          </Button>
        )}
      </div>

      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
        留空使用默认模板。模板里 {`{product_name}`} 这类占位符会在运行时用上游节点输出自动填充。
      </p>
    </div>
  );
}
