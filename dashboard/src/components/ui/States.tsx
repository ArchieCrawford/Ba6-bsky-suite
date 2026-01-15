import { Button } from "./Button";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <div className="text-sm text-black/50">{label}...</div>;
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-black/20 bg-white/60 p-6 text-sm">
      <div className="font-semibold text-black/70">{title}</div>
      {subtitle && <div className="mt-1 text-black/50">{subtitle}</div>}
    </div>
  );
}

export function ErrorState({ title, subtitle, onRetry }: { title: string; subtitle?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm">
      <div className="font-semibold text-rose-700">{title}</div>
      {subtitle && <div className="mt-1 text-rose-600">{subtitle}</div>}
      {onRetry && (
        <div className="mt-4">
          <Button variant="danger" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
