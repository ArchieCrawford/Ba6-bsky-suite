"use client";

import { clsx } from "clsx";
import type { TextareaHTMLAttributes } from "react";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm",
        "placeholder:text-black/40 focus:border-ink focus:outline-none",
        className
      )}
      {...props}
    />
  );
}
