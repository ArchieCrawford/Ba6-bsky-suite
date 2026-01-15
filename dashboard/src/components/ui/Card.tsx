import { clsx } from "clsx";
import type { PropsWithChildren } from "react";

type CardProps = PropsWithChildren<{ className?: string }>;

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-black/10 bg-white/80 p-5 shadow-card backdrop-blur",
        className
      )}
    >
      {children}
    </div>
  );
}
