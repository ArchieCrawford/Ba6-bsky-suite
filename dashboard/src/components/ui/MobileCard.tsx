import { clsx } from "clsx";
import type { PropsWithChildren, ReactNode } from "react";

type MobileCardProps = PropsWithChildren<{
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  details?: ReactNode;
  actions?: ReactNode;
  className?: string;
}>;

export function MobileCard({ title, subtitle, status, details, actions, className, children }: MobileCardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-black/10 bg-white/80 p-4 shadow-card",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">{title}</div>
          {subtitle && <div className="mt-1 text-xs text-black/50 break-all">{subtitle}</div>}
        </div>
        {status}
      </div>
      {children && <div className="mt-3 text-sm text-black/70">{children}</div>}
      {details && (
        <details className="mt-3 text-xs text-black/60">
          <summary className="cursor-pointer uppercase tracking-wide text-black/50">Details</summary>
          <div className="mt-2 space-y-2">{details}</div>
        </details>
      )}
      {actions && <div className="mt-3">{actions}</div>}
    </div>
  );
}
