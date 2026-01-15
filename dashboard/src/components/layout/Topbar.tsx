"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { MobileNav } from "@/components/layout/MobileNav";
import { toast } from "sonner";

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
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 bg-white/70 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-4">
        <MobileNav />
        <div>
          <div className="text-sm uppercase tracking-[0.2em] text-black/40">control panel</div>
          <div className="text-xl font-semibold text-ink">Bluesky Ops</div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm text-black/70">
        <span className="rounded-full bg-black/5 px-3 py-1">{email ?? "Signed in"}</span>
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
