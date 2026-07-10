"use client";

import Link from "next/link";
import { useState } from "react";

type MobileNavGroup = {
  title: string;
  items: {
    href: string;
    label: string;
    external?: boolean;
  }[];
};

export const MobileNavigation = ({ groups }: { groups: MobileNavGroup[] }) => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur md:hidden">
      <div className="flex min-h-14 items-center justify-between gap-4 px-4">
        <Link href="/" className="font-black tracking-tight" onClick={() => setOpen(false)}>
          Personal OS
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-navigation-panel"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-bold text-zinc-800 shadow-sm"
        >
          {open ? "关闭" : "菜单"}
        </button>
      </div>

      {open ? (
        <div id="mobile-navigation-panel" className="border-t border-zinc-100 bg-white px-4 py-4 shadow-lg">
          <div className="grid gap-5">
            {groups.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                  {group.title}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item) =>
                    item.external ? (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setOpen(false)}
                        className="rounded-lg bg-zinc-100 px-3 py-2.5 text-sm font-semibold text-zinc-700"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="rounded-lg bg-zinc-100 px-3 py-2.5 text-sm font-semibold text-zinc-700"
                      >
                        {item.label}
                      </Link>
                    ),
                  )}
                </div>
              </nav>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
};
