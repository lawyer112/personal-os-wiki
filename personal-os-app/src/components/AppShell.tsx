"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
const navigation = [
  { group: "工作空间", items: [["/", "工作总览", "◈"], ["/wiki", "知识手册", "▤"], ["/projects", "项目进度", "▦"], ["/tasks", "任务中心", "☷"], ["/agents", "智能体中心", "◎"], ["/reviews", "交付与复核", "✓"]] },
  { group: "收集与管理", items: [["/capture", "快速收集", "＋"], ["/inbox", "待整理资料", "▣"], ["/ideas", "想法池", "◇"], ["/activity", "活动记录", "◷"], ["/settings", "系统管理", "⚙"]] },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname.startsWith("/auth")) return <div className="os-auth-shell">{children}</div>;
  const active = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const title = navigation.flatMap(group => group.items).find(([href]) => active(href))?.[1] ?? "工作空间";
  return <div className="os-shell">
    <a href="#workspace-main" className="os-skip">跳到主要内容</a>
    {open && <button className="os-nav-scrim" aria-label="关闭导航" onClick={() => setOpen(false)} />}
    <aside className={`os-sidebar${open ? " is-open" : ""}`}>
      <Link href="/" className="os-brand" onClick={() => setOpen(false)}><span className="os-brand-mark">知</span><div><strong>知行工作台</strong><span>个人知识与协作系统</span></div></Link>
      <div className="os-space"><span className="os-dot" /><span>内部工作空间</span><span className="os-space-tag">本地优先</span></div>
      {navigation.map(group => <nav key={group.group} className="os-nav-group" aria-label={group.group}><p>{group.group}</p>{group.items.map(([href, text, symbol]) => <Link key={href} href={href} className={`os-nav-link${active(href) ? " is-active" : ""}`} aria-current={active(href) ? "page" : undefined} onClick={() => setOpen(false)}><span aria-hidden="true">{symbol}</span>{text}{active(href) && <i aria-hidden="true" />}</Link>)}</nav>)}
      <div className="os-sidebar-bottom"><strong>知识有依据，工作有交付。</strong><p>认领 → 执行 → 提交 → 复核</p><Link href="/settings">接入与运行说明 ↗</Link></div>
    </aside>
    <div className="os-main-shell"><header className="os-topbar"><div className="os-topbar-left"><button className="os-mobile-toggle" aria-expanded={open} aria-label="展开导航" onClick={() => setOpen(!open)}>☰</button><span className="os-breadcrumb">工作空间 <span>/</span> <strong>{title}</strong></span></div><form action="/tasks" className="os-global-search"><span aria-hidden="true">⌕</span><input type="search" name="q" aria-label="搜索任务" placeholder="搜索任务与下一步…" /><kbd>搜索</kbd></form><Link href="/capture" className="os-btn os-btn-primary os-quick-capture">＋ 快速收集</Link></header><main id="workspace-main" className="os-main" tabIndex={-1}>{children}</main><footer className="os-footer">个人知识与协作系统<span>状态以服务端记录为准 · 执行完成不等于验收通过</span></footer></div>
  </div>;
}
