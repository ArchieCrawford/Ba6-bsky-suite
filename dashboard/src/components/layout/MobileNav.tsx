"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Menu, X } from "lucide-react";
import { navItems } from "./navItems";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-black/10 bg-white/80 px-3 text-ink md:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu size={18} />
      </button>

      <div className={clsx("fixed inset-0 z-50 md:hidden", !open && "pointer-events-none")}>
        <div
          className={clsx("absolute inset-0 bg-black/40 transition-opacity", open ? "opacity-100" : "opacity-0")}
          onClick={() => setOpen(false)}
        />
        <aside
          className={clsx(
            "absolute left-0 top-0 h-full w-72 max-w-[80vw] bg-white shadow-soft transition-transform",
            "flex flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-4">
            <div>
              <div className="text-sm font-semibold text-ink">BA6 Control</div>
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Bluesky Suite</div>
            </div>
            <button
              type="button"
              aria-label="Close navigation"
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-black/10 bg-white/80 px-2 text-black/60"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition",
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
        </aside>
      </div>
    </>
  );
}
