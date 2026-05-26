"use client";

import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/store/ui-store";
import { CreateProjectDialog } from "@/components/project/create-project-dialog";
import {
  ArrowRight,
  ArrowDown,
  Upload,
  Sparkles,
  Video,
  Clapperboard,
} from "lucide-react";

const PHASES = [
  {
    step: "01",
    title: "上传商品图",
    en: "Upload",
    desc: "拖入一张白底商品图,或直接粘贴电商链接。系统自动去背景、识别品类、提取视觉特征。",
    icon: Upload,
    gradient: "from-amber-100/80 to-orange-50/40",
  },
  {
    step: "02",
    title: "AI 生成脚本与分镜",
    en: "Script & Storyboard",
    desc: "大模型分析卖点,生成多版营销文案。自动拆分镜头,规划画面、字幕、配音的时间线。",
    icon: Sparkles,
    gradient: "from-rose-100/80 to-pink-50/40",
  },
  {
    step: "03",
    title: "生成画面与视频",
    en: "Generate",
    desc: "调用通义万相 / Kling / Veo 等模型,逐镜头生成关键帧与视频片段。每个节点可独立替换模型。",
    icon: Video,
    gradient: "from-violet-100/80 to-purple-50/40",
  },
  {
    step: "04",
    title: "合成导出",
    en: "Compose & Export",
    desc: "FFmpeg 自动合成画面、字幕、配音、背景音乐。一键导出 MP4,适配小红书 / 抖音 / TikTok。",
    icon: Clapperboard,
    gradient: "from-emerald-100/80 to-teal-50/40",
  },
];

const PLATFORMS = [
  { name: "小红书", en: "Xiaohongshu", desc: "9:16 竖屏 · 15-60s · 算法优化" },
  { name: "抖音", en: "Douyin", desc: "9:16 竖屏 · 15-60s · 信息流适配" },
  { name: "TikTok", en: "TikTok", desc: "9:16 竖屏 · 15-60s · FYP 算法" },
  { name: "微信视频号", en: "WeChat", desc: "9:16 竖屏 · 15-60s · 社交分发" },
];

export default function HomePage() {
  const router = useRouter();
  const openCreateDialog = useUIStore((s) => s.openCreateDialog);

  return (
    <div className="relative grain">
      <SiteHeader />
      <CreateProjectDialog />

      {/* ═══════════════════════════════════════════════════════════
          S1 · HERO — 100vh
          ═══════════════════════════════════════════════════════════ */}
      <section className="section-full bg-gradient-to-b from-background via-background to-secondary/30">
        <div className="orb-tl orb-signal" style={{ top: "-10%", left: "-5%" }} />
        <div className="orb-br orb-jade" style={{ bottom: "-10%", right: "-5%" }} />
        <div
          className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: "oklch(0.75 0.15 70 / 0.5)" }}
        />

        <div className="mx-auto max-w-[1400px] px-8 w-full py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-signal/30 bg-signal/5">
                <span className="w-2 h-2 rounded-full bg-signal pulse-dot" />
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-signal">
                  AI-POWERED · VIDEO PIPELINE
                </span>
              </div>

              <h1 className="text-[clamp(44px,8vw,104px)] leading-[0.92] tracking-[-0.025em]">
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}>
                  一张商品图,
                </span>
                <br />
                <span className="text-gradient" style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}>
                  自动变成
                </span>
                <br />
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}>
                  可发布的
                </span>{" "}
                <em
                  className="not-italic text-muted-foreground/40"
                  style={{ fontFamily: "var(--font-display-en)", fontStyle: "italic", fontWeight: 400 }}
                >
                  marketing video.
                </em>
              </h1>

              <p className="text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
                用 11 段固定流水线, 把商品图变成适配小红书、抖音、TikTok 的短视频。
                <br />
                不需要剪辑师, 不需要文案, 不需要配音演员。
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Button
                  onClick={openCreateDialog}
                  className="h-14 px-8 bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-sm tracking-[0.18em] uppercase gap-2.5 shadow-glow lift rounded-xl"
                >
                  开始生成
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <button
                  onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                  className="h-14 px-6 rounded-xl border border-border/60 bg-background/60 backdrop-blur-sm hover:bg-secondary/40 font-mono text-sm tracking-[0.1em] flex items-center gap-2 transition-colors"
                >
                  了解更多
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-x-12 gap-y-4 pt-4 border-t border-border/40">
                {[{ n: "1", label: "张商品图" }, { n: "11", label: "段流水线" }, { n: "≈4", label: "分钟生成" }].map((s) => (
                  <div key={s.label}>
                    <span className="text-4xl md:text-5xl tabular-nums" style={{ fontFamily: "var(--font-display-en)", fontWeight: 700 }}>
                      {s.n}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* floating pipeline illustration */}
            <div className="lg:col-span-5 hidden lg:block">
              <div className="relative">
                <div className="glass-card p-6 rounded-2xl shadow-md mx-auto max-w-sm space-y-4">
                  {[
                    { icon: Upload, color: "bg-signal/10 text-signal", label: "商品图上传", sub: "Input Node" },
                    { icon: Sparkles, color: "bg-amber-100 text-amber-600", label: "AI 脚本生成", sub: "Text Node" },
                    { icon: Video, color: "bg-violet-100 text-violet-600", label: "视频生成", sub: "Video Node" },
                    { icon: Clapperboard, color: "bg-secondary text-muted-foreground", label: "合成导出", sub: "Output", muted: true },
                  ].map((item, i) => (
                    <div key={item.label}>
                      <div className={`flex items-center gap-3 ${item.muted ? "opacity-50" : ""}`}>
                        <div className={`w-10 h-10 rounded-xl grid place-items-center ${item.color}`}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{item.sub}</p>
                        </div>
                      </div>
                      {i < 3 && <div className="h-px bg-border/40 my-4 ml-[52px]" />}
                    </div>
                  ))}
                </div>
                <div className="absolute -top-4 -right-4 glass-card px-4 py-3 rounded-xl shadow-md">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-signal">⚡ ~4 min</p>
                </div>
                <div className="absolute -bottom-3 -left-3 glass-card px-4 py-3 rounded-xl shadow-md">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">4 大平台</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          S2 · IMPACT — dark stripe
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-foreground text-background">
        <div className="orb-tl orb-warm" style={{ top: "10%", opacity: 0.15 }} />
        <div className="mx-auto max-w-[1400px] px-8 py-28 md:py-40">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6 scroll-reveal">
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-signal">THE MAGIC</p>
              <h2 className="text-[clamp(36px,6vw,72px)] leading-[1.05]" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>
                不需要<br />剪辑师、<br />文案、<br />配音演员。
              </h2>
            </div>
            <div className="space-y-10 scroll-reveal-sm">
              <p className="text-lg leading-relaxed opacity-80 max-w-md">
                传统短视频制作需要 3-5 人协作 2-3 小时。PixelFlow 用一条{" "}
                <span className="text-signal font-medium">固定顺序的 AI 流水线</span>, 把整个过程压缩到 4 分钟。
              </p>
              <div className="grid grid-cols-2 gap-6">
                {[
                  { n: "0", label: "人工剪辑", sub: "全程自动" },
                  { n: "11", label: "AI 节点", sub: "可独立重跑" },
                  { n: "∞", label: "模型组合", sub: "热替换, 无需重来" },
                  { n: "1", label: "次上传", sub: "即可完成" },
                ].map((s) => (
                  <div key={s.label} className="space-y-1">
                    <span className="text-5xl md:text-6xl tabular-nums text-signal" style={{ fontFamily: "var(--font-display-en)", fontWeight: 700 }}>
                      {s.n}
                    </span>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs opacity-50">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          S3 · HOW IT WORKS
          ═══════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative bg-background">
        <div className="mx-auto max-w-[1400px] px-8 py-28 md:py-40">
          <div className="text-center mb-24 scroll-reveal">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-signal mb-4">HOW IT WORKS</p>
            <h2 className="text-[clamp(36px,6vw,72px)] leading-[1.05]" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>
              四步,<br />从商品图到成片。
            </h2>
          </div>

          <div className="space-y-8">
            {PHASES.map((phase, i) => {
              const Icon = phase.icon;
              return (
                <div key={phase.step} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  <div className="lg:col-span-2 flex lg:justify-center scroll-reveal-sm">
                    <span className="stat-number text-foreground/6">{phase.step}</span>
                  </div>
                  <div className="lg:col-span-5 scroll-reveal">
                    <div className={`glass-card p-8 rounded-2xl bg-gradient-to-br ${phase.gradient}`}>
                      <div className="w-12 h-12 rounded-2xl bg-signal/10 grid place-items-center mb-5">
                        <Icon className="w-6 h-6 text-signal" />
                      </div>
                      <h3 className="text-2xl mb-3" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>{phase.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{phase.desc}</p>
                      <p className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground/50 mt-4">{phase.en}</p>
                    </div>
                  </div>
                  <div className="hidden lg:block lg:col-span-5" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          S4 · PLATFORMS
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-secondary/20">
        <div className="orb-br orb-jade" style={{ bottom: "0%", opacity: 0.3 }} />
        <div className="mx-auto max-w-[1400px] px-8 py-28 md:py-36">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
            <div className="lg:col-span-5 space-y-5 scroll-reveal">
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-signal">PLATFORMS</p>
              <h2 className="text-[clamp(32px,5vw,64px)] leading-[1.05]" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>
                为短视频<br />投放而生。
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                输出比例、时长、节奏都按各平台的算法偏好做了预设。无需手动调整, 导出即投。
              </p>
            </div>
            <div className="lg:col-span-7 grid grid-cols-2 gap-4 scroll-reveal-sm">
              {PLATFORMS.map((p) => (
                <div key={p.name} className="glass-card p-6 rounded-2xl space-y-2">
                  <p className="text-xl" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>{p.name}</p>
                  <p className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">{p.en}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          S5 · CTA — full-bleed signal
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-signal to-oklch(0.55 0.18 25)">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/8 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white/6 translate-y-1/3 -translate-x-1/4" />

        <div className="relative mx-auto max-w-[1400px] px-8 py-32 md:py-44 text-center">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/60 mb-6 scroll-reveal-sm">READY TO START</p>
          <h2 className="text-[clamp(36px,7vw,80px)] leading-[0.95] text-white mb-10 scroll-reveal" style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}>
            别再为<br />一支视频熬到凌晨三点。
          </h2>
          <p className="text-white/70 text-lg mb-12 max-w-md mx-auto scroll-reveal-sm">
            传一张图, 泡一杯咖啡。回来的时候, 成片已经在导出列表里。
          </p>
          <div className="scroll-reveal-sm">
            <Button
              onClick={openCreateDialog}
              className="h-16 px-10 bg-white text-foreground hover:bg-white/90 font-mono text-base tracking-[0.15em] uppercase gap-3 rounded-2xl shadow-lg lift"
            >
              立即开始
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background">
        <div className="mx-auto max-w-[1400px] px-8 py-6 flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/50">
          <span>PIXELFLOW · 像素流 © 2026</span>
          <span>built for vertical commerce video.</span>
          <span>v 0.1 · MVP</span>
        </div>
      </footer>
    </div>
  );
}
