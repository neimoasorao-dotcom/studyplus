import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studyplus 学習分析",
  description: "学習記録を比較し、学習状態と改善策を確認する個人用ダッシュボード。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
