import type { Metadata } from "next";
import "./globals.css";
import {colorModeBootstrap} from "../lib/color-mode";

export const metadata: Metadata = {
  title: "Studyplus 学習分析",
  description: "学習記録を比較し、学習状態と改善策を確認する個人用ダッシュボード。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: [{url:"/favicon-32.png",type:"image/png",sizes:"32x32"},{url:"/favicon.svg",type:"image/svg+xml",sizes:"any"}],
    shortcut: "/favicon.svg",
    apple: [{url:"/apple-touch-icon.png",sizes:"180x180",type:"image/png"}],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:colorModeBootstrap}}/></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
