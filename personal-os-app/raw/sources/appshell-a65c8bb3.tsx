import Link from "next/link";
import { wikiOpenUrl } from "@/lib/app-config";

type NavItem = {
  href: string;
  label: string;
  external?: boolean;
};

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "工作台",
    items: [
      { href: "/", label: "今日" },
      { href: "/capture", label: "采集" },
      { href: "/inbox", label: "输入箱" },
      { href: "/ideas", label: "想法池" },
      { href: "/projects", label: "项目" },
      { href: "/wiki", label: "知识库" },
    ],
  },
  {
    title: "快速打开",
    items: [
      { href: wikiOpenUrl("/"), label: "打开 Wiki", external: true },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#eef1f4] text-zinc-950">
      <div className="grid min-h-screen grid-cols-[232px_minmax(0,1fr)]">
        <aside className="border-r border-zinc-200 bg-white px-4 py-5">
          <Link href="/" className="block rounded-lg px-3 py-2">
            <div className="text-lg font-bold tracking-tight">Personal OS</div>
            <div className="mt-1 text-xs leading-5 text-zinc-500">
              今日任务、想法、输入和知识检索
            </div>
          </Link>

          <div className="mt-7 grid gap-6">
            {navGroups.map((group) => (
              <nav key={group.title}>
                <div className="mb-2 px-3 text-xs font-semibold uppercase text-zinc-500">
                  {group.title}
                </div>
                <div className="grid gap-1">
                  {group.items.map((item) =>
                    item.external ? (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        {item.label}
                      </Link>
                    ),
                  )}
                </div>
              </nav>
            ))}
          </div>
        </aside>

        <main className="min-w-0 px-6 py-5">{children}</main>
      </div>
    </div>
  );
}
