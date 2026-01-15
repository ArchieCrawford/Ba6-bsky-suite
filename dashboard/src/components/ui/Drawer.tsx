"use client";

import { clsx } from "clsx";
import type { PropsWithChildren } from "react";

type DrawerProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title?: string;
}>;

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  return (
    <div className={clsx("fixed inset-0 z-40", !open && "pointer-events-none")}>
      <div
        className={clsx(
          "absolute inset-0 bg-black/30 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        className={clsx(
          "absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-soft transition-transform",
          "flex flex-col",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <div className="text-sm font-semibold uppercase tracking-wide text-black/60">
            {title}
          </div>
          <button className="text-sm text-black/60" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </aside>
    </div>
  );
}
