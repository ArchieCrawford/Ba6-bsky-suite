import Link from "next/link";
import { Beaker } from "lucide-react";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-ba6-border bg-black/30 shadow-glow">
            <Beaker size={18} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">BA6</div>
            <div className="text-xs text-ba6-muted">Clanker Launcher • Local</div>
          </div>
        </Link>

        <div className="flex items-center gap-2 text-xs text-ba6-muted">
          <span className="rounded-full border border-ba6-border bg-black/30 px-3 py-1">
            mock API enabled
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">{children}</main>

      <footer className="mx-auto max-w-6xl px-6 pb-10 pt-2 text-xs text-ba6-muted">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ba6-border/60 pt-6">
          <span>BA6 local preview repo • safe defaults</span>
          <span>Ownership transfers to the user in the real deployment flow</span>
        </div>
      </footer>
    </div>
  );
}
