"use client";

import { clsx } from "clsx";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm",
        "placeholder:text-black/40 focus:border-ink focus:outline-none",
        className
      )}
      {...props}
    />
  );
}
