"use client";

import { clsx } from "clsx";
import type { SelectHTMLAttributes } from "react";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm",
        "focus:border-ink focus:outline-none",
        className
      )}
      {...props}
    />
  );
}
