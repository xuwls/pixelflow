"use client";

import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/store/ui-store";
import { CreateProjectDialog } from "@/components/project/create-project-dialog";
import {
  ArrowRight,
  Upload,
  Scan,
  Sparkles,
  FileText,
  Layout,
  Wand,
  Image as ImageIcon,
  Video,
  Type,
  Mic,
  Clapperboard,
} from "lucide-react";

const PIPELINE = [
  { label: "商品输入", en: "Input", icon: Upload },
  { label: "商品理解", en: "Vision", icon: Scan },
  { label: "卖点生成", en: "Hook", icon: Sparkles },
  { label: "脚本生成", en: "Script", icon: FileText },
  { label: "分镜生成", en: "Storyboard", icon: Layout },
  { label: "提示词生成", en: "Prompt", icon: Wand },
  { label: "关键帧生成", en: "Keyframe", icon: ImageIcon },
  { label: "视频生成", en: "Video", icon: Video },
  { label: "字幕生成", en: "Subtitle", icon: Type },
  { label: "配音生成", en: "Voice", icon: Mic },
  { label: "视频合成", en: "Compose", icon: Clapperboard },
];

const PRINCIPLES = [
  {
    no: "01",
    title: "不是工作流平台",
    body: "没有节点拖拽,没有自由分支,没有插件市场。我们只做一件事——把商品做成视频。",
  },
  {
    no: "02",
    title: "顺序是被锁定的",
    body: "理解 → 文案 → 分镜 → 画面 → 视频 → 合成。每一步可以重跑,但不能被绕过。",
  },
  {
    no: "03",
    title: "为短视频投放而生",
    body: "输出比例、时长、节奏都按小红书 / 抖音 / TikTok 的算法偏好做了预设。",
  },
];

const PLATFORMS = ["小红书 · Xiaohongshu", "抖音 · Douyin", "TikTok", "微信视频号"];

export default function HomePage() {
  const router = useRouter();
  const openCreateDialog = useUIStore((s) => s.openCreateDialog);

  return (
    <div className="min-h-screen relative grain">
      <SiteHeader />
      <CreateProjectDialog />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border bg-hairline">
        <div className="mx-auto max-w-[1600px] px-6 pt-20 pb-24 md:pt-28 md:pb-32 grid grid-cols-12 gap-6 relative">
          {/* meta strip */}
          <div className="col-span-12 flex items-center justify-between font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground reveal reveal-1">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-signal rounded-full pulse-dot" />
              <span>SYSTEM ONLINE · v0.1 MVP</span>
            </div>
            <span className="hidden md:block">东京 / 杭州 / 旧金山 — 2026</span>
          </div>

          {/* huge editorial heading */}
          <div className="col-span-12 md:col-span-9 mt-8 md:mt-14 reveal reveal-2">
            <h1
              className="text-[44px] sm:text-[72px] md:text-[120px] leading-[0.92] tracking-[-0.02em] text-foreground"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}
            >
              一张商品图,
              <br />
              <span className="relative inline-block">
                自动产出
                <span className="absolute -bottom-2 left-0 right-0 h-[3px] bg-signal" />
              </span>
              <br />
              <em
                className="not-italic text-muted-foreground"
                style={{ fontFamily: "var(--font-display-en)", fontStyle: "italic", fontWeight: 400 }}
              >
                ready-to-post
              </em>
              <br />
              营销短视频。
            </h1>
          </div>

          <div className="col-span-12 md:col-span-3 md:pt-16 reveal reveal-3">
            <p className="text-sm leading-relaxed text-muted-foreground max-w-xs">
              <span className="text-foreground">PixelFlow</span> 是一条
              <span className="text-signal">固定顺序</span>
              的商品视频流水线。
              <br />
              <br />
              你只需要上传一张商品图。脚本、分镜、画面、配音、字幕、合成——交给系统的十一段流程自动完成。
            </p>
            <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {PLATFORMS.map((p) => (
                <span
                  key={p}
                  className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground"
                >
                  ▸ {p}
                </span>
              ))}
            </div>
          </div>

          {/* CTA row */}
          <div className="col-span-12 mt-10 md:mt-16 flex flex-wrap items-center gap-3 reveal reveal-4">
            <Button
              onClick={openCreateDialog}
              className="h-11 px-5 bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs tracking-[0.18em] uppercase gap-2"
            >
              开始生成第一支视频
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/projects")}
              className="h-11 px-5 border-border bg-transparent hover:bg-secondary/60 font-mono text-xs tracking-[0.18em] uppercase"
            >
              查看项目库
            </Button>
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground ml-2">
              平均生成时长 · ≈ 4 min
            </span>
          </div>

          {/* corner index */}
          <div
            className="hidden md:block absolute top-20 right-6 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground writing-vertical reveal reveal-2"
            style={{ writingMode: "vertical-rl" }}
          >
            ISSUE / 001 — 像素流 · PIXELFLOW
          </div>
        </div>

        {/* scrolling ticker bar */}
        <div className="border-t border-border overflow-hidden">
          <div className="flex whitespace-nowrap font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground py-3 ticker">
            {Array.from({ length: 2 }).map((_, k) => (
              <div key={k} className="flex shrink-0">
                {[
                  "上传商品图",
                  "AI 解析卖点",
                  "生成营销文案",
                  "拆分镜头",
                  "生成关键帧",
                  "通义万相 / Kling / Veo",
                  "FFmpeg 合成",
                  "字幕烧录",
                  "TTS 配音",
                  "导出 MP4",
                ].map((t, i) => (
                  <span key={`${k}-${i}`} className="inline-flex items-center px-6">
                    <span className="w-1 h-1 rounded-full bg-signal mr-3" />
                    {t}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PIPELINE TIMELINE */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-6 py-20 md:py-28 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-3">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-signal mb-3">
              § 02 · 流水线
            </p>
            <h2
              className="text-3xl md:text-4xl leading-tight text-foreground"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
            >
              十一段
              <br />
              固定顺序。
            </h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              每一段都是一个独立可重跑的节点。失败不影响上下游,模型可热替换。
            </p>
          </div>

          <ol className="col-span-12 md:col-span-9 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-border border border-border">
            {PIPELINE.map((step, i) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.label}
                  className="group relative bg-background hover:bg-secondary/60 transition-colors p-4 min-h-[110px] flex flex-col justify-between"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")} / 11
                    </span>
                    <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-signal transition-colors" />
                  </div>
                  <div>
                    <p className="text-base text-foreground tracking-wide">{step.label}</p>
                    <p
                      className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground mt-0.5"
                      style={{ fontFamily: "var(--font-display-en)", fontStyle: "italic" }}
                    >
                      {step.en}
                    </p>
                  </div>
                </li>
              );
            })}
            {/* finishing tile */}
            <li className="bg-signal text-signal-foreground p-4 min-h-[110px] flex flex-col justify-between">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase">FINAL · 成片</span>
              <div>
                <p
                  className="text-lg leading-tight"
                  style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}
                >
                  导出 MP4
                </p>
                <p className="font-mono text-[10px] tracking-wider uppercase mt-0.5 opacity-80">
                  ready · for · post
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-6 py-20 md:py-28 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-4">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-signal mb-3">
              § 03 · 原则
            </p>
            <h2
              className="text-3xl md:text-5xl leading-[0.95] text-foreground"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
            >
              三件
              <br />
              <em
                className="not-italic text-muted-foreground"
                style={{ fontFamily: "var(--font-display-en)", fontStyle: "italic" }}
              >
                we don&apos;t do.
              </em>
            </h2>
          </div>
          <div className="col-span-12 md:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-px bg-border border-y border-l border-r border-border">
            {PRINCIPLES.map((p) => (
              <article
                key={p.no}
                className="bg-background p-6 min-h-[260px] flex flex-col justify-between hover:bg-secondary/40 transition-colors"
              >
                <span
                  className="text-[64px] leading-none text-foreground/15 select-none"
                  style={{ fontFamily: "var(--font-display-en)", fontWeight: 900 }}
                >
                  {p.no}
                </span>
                <div>
                  <h3
                    className="text-xl text-foreground mb-2"
                    style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
                  >
                    {p.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* OUTRO CTA */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-[1600px] px-6 py-24 md:py-36 grid grid-cols-12 gap-6 items-end">
          <div className="col-span-12 md:col-span-8">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
              § 04 · 现在
            </p>
            <h2
              className="text-[40px] md:text-[88px] leading-[0.95] tracking-[-0.02em]"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}
            >
              别再为
              <span className="text-signal">一支视频</span>
              <br />
              熬到凌晨三点。
            </h2>
          </div>
          <div className="col-span-12 md:col-span-4 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              传一张图,泡一杯咖啡。回来的时候,成片已经在导出列表里。
            </p>
            <Button
              onClick={openCreateDialog}
              className="h-12 w-full md:w-auto px-6 bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs tracking-[0.2em] uppercase gap-2"
            >
              立即开始 → CREATE
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* footer rule */}
        <div className="border-t border-border">
          <div className="mx-auto max-w-[1600px] px-6 py-5 flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            <span>PIXELFLOW · 像素流 © 2026</span>
            <span>built for vertical commerce video.</span>
            <span>v 0.1 · MVP</span>
          </div>
        </div>
      </section>
    </div>
  );
}
