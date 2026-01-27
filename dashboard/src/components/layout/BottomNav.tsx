"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { navItems } from "./navItems";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/10 bg-white/90 backdrop-blur md:hidden">
      <div className="grid grid-cols-6 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex min-h-[56px] flex-col items-center justify-center gap-1 px-2 text-[11px] font-medium",
                active ? "text-ink" : "text-black/50"
              )}
            >
              <Icon size={18} className={clsx(active ? "text-ink" : "text-black/40")} />
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
