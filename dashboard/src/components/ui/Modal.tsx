"use client";

import { clsx } from "clsx";
import type { PropsWithChildren } from "react";

type ModalProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title?: string;
}>;

export function Modal({ open, onClose, title, children }: ModalProps) {
  return (
    <div className={clsx("fixed inset-0 z-50", !open && "pointer-events-none")}> 
      <div
        className={clsx(
          "absolute inset-0 bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={clsx(
          "absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2",
          "max-h-[85vh] overflow-y-auto rounded-xl border border-black/10 bg-white p-6 shadow-soft transition",
          open ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-black/60">{title}</div>
        {children}
      </div>
    </div>
  );
}
