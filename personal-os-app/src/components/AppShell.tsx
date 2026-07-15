import Link from "next/link";

type NavItem = {
  href: string;
  label: string;
  description: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "今天", description: "查看今日重点和待确认事项" },
  { href: "/tasks", label: "推进", description: "任务、项目和证据都在这里继续" },
  { href: "/capture", label: "收集", description: "先放进来，稍后再整理" },
  { href: "/wiki", label: "记忆", description: "能复用的资料和项目记录" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-[var(--ink)]">
      <div className="grid min-h-screen grid-cols-[260px_minmax(0,1fr)] gap-0">
        <aside className="sticky top-0 h-screen border-r border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--surface)_86%,transparent)] px-5 py-6 backdrop-blur-xl">
          <Link
            href="/"
            className="block rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition hover:border-[var(--border-strong)]"
          >
            <div className="text-lg font-bold tracking-tight text-[var(--ink)]">
              Personal OS
            </div>
            <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
              个人工作台
            </div>
          </Link>

          <nav className="mt-7 grid gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-3xl px-4 py-3 transition hover:bg-[var(--surface)] hover:shadow-[var(--shadow-card)]"
              >
                <div className="text-base font-bold text-[var(--ink)] group-hover:text-[var(--brand-strong)]">
                  {item.label}
                </div>
                <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                  {item.description}
                </div>
              </Link>
            ))}
          </nav>

          <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-xs leading-5 text-[var(--ink-muted)] shadow-[var(--shadow-card)]">
            <div className="font-semibold text-[var(--ink)]">使用顺序</div>
            <p className="mt-1">先决定今天，推进一件事，再整理新输入。</p>
          </div>
        </aside>

        <main className="min-w-0 px-7 py-6">
          <div className="mx-auto w-full max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
