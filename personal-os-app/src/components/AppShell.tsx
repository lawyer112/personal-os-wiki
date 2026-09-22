"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AppearanceControls } from "./workspace/AppearanceControls";
import { BrandMark, Icon, type IconName } from "./workspace/Icons";
const navigation: { group: string; items: [string, string, IconName][] }[] = [
  { group: "工作空间", items: [["/", "工作总览", "overview"], ["/wiki", "知识手册", "book"], ["/projects", "项目进度", "projects"], ["/tasks", "任务中心", "tasks"], ["/agents", "智能体中心", "agents"], ["/reviews", "交付与复核", "check"]] },
  { group: "收集与管理", items: [["/capture", "快速收集", "plus"], ["/inbox", "待整理资料", "inbox"], ["/ideas", "想法池", "idea"], ["/activity", "活动记录", "clock"], ["/settings", "系统管理", "settings"]] },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.getElementById("workspace-search")?.focus(); }
      if (event.key === "Escape" && open) { setOpen(false); menu.current?.focus(); }
      if (event.key === "Tab" && open && sidebar.current) {
        const items = Array.from(sidebar.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)'));
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keyboard);
    if (open) { sidebar.current?.querySelector<HTMLElement>('a[aria-current="page"]')?.focus(); document.body.style.overflow = "hidden"; }
    return () => { document.removeEventListener("keydown", keyboard); document.body.style.overflow = ""; };
  }, [open]);
  if (pathname.startsWith("/auth")) return <div className="os-auth-shell">{children}</div>;
  const active = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const title = navigation.flatMap(group => group.items).find(([href]) => active(href))?.[1] ?? "工作空间";
  return <div className="os-shell">
    <a href="#workspace-main" className="os-skip">跳到主要内容</a>
    {open && <button className="os-nav-scrim" aria-label="关闭导航" onClick={() => { setOpen(false); menu.current?.focus(); }} />}
    <aside ref={sidebar} className={`os-sidebar${open ? " is-open" : ""}`} aria-label="工作台导航">
      <Link href="/" className="os-brand" onClick={() => setOpen(false)}><span className="os-brand-mark"><BrandMark /></span><div><strong>知行<span>工作台</span></strong><span>你的知识，自成宇宙。</span></div></Link>
      <div className="os-space"><span className="os-space-icon"><Icon name="compass" size={18} /></span><div>个人工作空间<small>本地优先 · 内部协作</small></div><span className="os-space-arrow">⌄</span></div>
      {navigation.map(group => { const index = group.items.findIndex(([href]) => active(href)); return <nav key={group.group} className="os-nav-group" aria-label={group.group}><p>{group.group}<span /></p><div className="os-nav-items"><span className="os-nav-highlight" aria-hidden="true" style={{ "--nav-index": Math.max(0, index), opacity: index < 0 ? 0 : 1 } as CSSProperties} />{group.items.map(([href, text, icon]) => <Link key={href} href={href} className={`os-nav-link${active(href) ? " is-active" : ""}`} aria-current={active(href) ? "page" : undefined} onClick={() => setOpen(false)}><Icon name={icon} /><span>{text}</span><Icon name="arrow" size={14} /></Link>)}</div></nav>; })}
      <div className="os-sidebar-bottom"><div className="os-sidebar-seal"><BrandMark /></div><strong>每一次沉淀，都有回响。</strong><p>知识有依据，行动有记录。</p><Link href="/settings">接入与运行说明 <Icon name="external" size={13} /></Link></div>
    </aside>
    <div className="os-main-shell"><header className="os-topbar"><div className="os-topbar-left"><button ref={menu} className="os-mobile-toggle" aria-expanded={open} aria-label="展开导航" onClick={() => setOpen(!open)}><Icon name="menu" size={23} /></button><span className="os-breadcrumb">工作空间 <span>/</span> <strong>{title}</strong></span></div><form action="/tasks" className="os-global-search"><Icon name="search" size={16} /><input id="workspace-search" type="search" name="q" aria-label="搜索任务" placeholder="搜索任务与下一步" /><kbd>Ctrl K</kbd></form><AppearanceControls /><Link href="/capture" className="os-btn os-quick-capture"><Icon name="plus" size={16} /><span>快速收集</span></Link></header>
      <main id="workspace-main" className="os-main" tabIndex={-1}><div key={pathname} className="os-page-transition">{children}</div></main>
      <footer className="os-footer"><span className="os-footer-brand">知行 <i>·</i> 个人知识与协作系统</span><span>知识可追溯，交付可验证。</span></footer>
    </div>
  </div>;
}
