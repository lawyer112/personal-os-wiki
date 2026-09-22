import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";
import "@/components/workspace/workspace.css";
import "@/components/workspace/readability.css";
export const metadata: Metadata = { title: { default: "知行工作台 · 个人知识与协作系统", template: "%s · 知行工作台" }, description: "局域网内部的中文知识手册、任务进度、智能体协作与交付复核工作台。" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body><AppShell>{children}</AppShell></body></html>; }
