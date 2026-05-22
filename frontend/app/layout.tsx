import type { Metadata } from "next";
import { Noto_Serif_SC, Noto_Sans_SC, JetBrains_Mono, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-display-cn",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-sans-cn",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-display-en",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PixelFlow · 像素流 — AI 商品视频流水线",
  description: "上传一张商品图,自动生成可直接发布到小红书 / 抖音 / TikTok 的营销视频。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${notoSerifSC.variable} ${notoSansSC.variable} ${fraunces.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
