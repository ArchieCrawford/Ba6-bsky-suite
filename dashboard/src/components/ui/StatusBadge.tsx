import { clsx } from "clsx";

const styles: Record<string, string> = {
  queued: "bg-amber-100 text-amber-700 border-amber-200",
  posting: "bg-sky-100 text-sky-700 border-sky-200",
  posted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  failed: "bg-rose-100 text-rose-700 border-rose-200",
  canceled: "bg-slate-200 text-slate-700 border-slate-300"
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        styles[status] ?? "bg-slate-100 text-slate-700 border-slate-200"
      )}
    >
      {status}
    </span>
  );
}
