"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Menu, X } from "lucide-react";
import { navItems } from "./navItems";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <button
        className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
      >
        <Menu size={16} />
        Menu
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-4 right-4 top-6 rounded-xl border border-black/10 bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Navigate</div>
              <button className="text-black/60" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <nav className="mt-4 space-y-2">
              {navItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
                      active ? "bg-ink text-white" : "bg-black/5 text-black/70"
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
