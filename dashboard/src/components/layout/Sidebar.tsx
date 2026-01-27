"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { navItems } from "./navItems";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 flex-col border-r border-black/10 bg-white/70 p-6 backdrop-blur md:flex">
      <div className="text-lg font-semibold tracking-tight text-ink">BA6 Control</div>
      <div className="mt-1 text-xs uppercase tracking-[0.2em] text-black/40">Bluesky Suite</div>

      <nav className="mt-8 space-y-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-ink text-white shadow"
                  : "text-black/70 hover:bg-black/5 hover:text-black"
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl border border-black/10 bg-white/80 p-4 text-xs text-black/60">
        Keep the scheduler lean and feeds sharp.
      </div>
    </aside>
  );
}
