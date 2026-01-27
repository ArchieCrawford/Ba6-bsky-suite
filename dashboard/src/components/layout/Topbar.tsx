"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { MobileNav } from "@/components/layout/MobileNav";
import { MoreHorizontal } from "lucide-react";

export function Topbar() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!mounted) return;
        if (error) throw error;
        setEmail(data.user?.email ?? null);
      } catch (err: any) {
        if (!mounted) return;
        toast.error(err?.message ?? "Failed to load session");
      }
    };
    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  const onSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login");
    } catch (err: any) {
      toast.error(err?.message ?? "Sign out failed");
    }
  };

  return (
    <header className="border-b border-black/10 bg-white/70 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur sm:px-6 sm:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MobileNav />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-black/40 sm:text-sm">control panel</div>
            <div className="text-lg font-semibold text-ink sm:text-xl">Bluesky Ops</div>
          </div>
        </div>

        <details className="relative sm:hidden">
          <summary className="inline-flex min-h-[44px] list-none items-center justify-center rounded-xl border border-black/10 bg-white/80 px-3 text-ink">
            <MoreHorizontal size={18} />
          </summary>
          <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-black/10 bg-white p-3 text-xs text-black/70 shadow-soft">
            <div className="rounded-xl bg-black/5 px-3 py-2 break-all">{email ?? "Signed in"}</div>
            <Button variant="ghost" size="sm" onClick={onSignOut} className="mt-3 w-full">
              Sign out
            </Button>
          </div>
        </details>

        <div className="hidden items-center gap-2 text-xs text-black/70 sm:flex sm:text-sm">
          <span className="rounded-full bg-black/5 px-3 py-1 break-all">{email ?? "Signed in"}</span>
          <Button variant="ghost" size="sm" onClick={onSignOut} className="w-auto">
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
