import { clsx } from "clsx";

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }
) {
  const { className, variant = "primary", ...rest } = props;

  const base =
    "inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none";
  const styles =
    variant === "ghost"
      ? "border border-ba6-border bg-black/20 hover:bg-black/30 text-ba6-text"
      : "border border-ba6-border bg-ba6-accent/20 hover:bg-ba6-accent/26 shadow-glow text-ba6-text";

  return <button className={clsx(base, styles, className)} {...rest} />;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight">{children}</h2>;
}

export function Divider() {
  return <div className="h-px w-full bg-ba6-border/70" />;
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-ba6-border bg-black/30 px-3 py-1 text-xs text-ba6-muted">
      {children}
    </span>
  );
}
