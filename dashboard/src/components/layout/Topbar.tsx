"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
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
    <header className="flex flex-col gap-3 border-b border-black/10 bg-white/70 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-black/40 sm:text-sm">control panel</div>
        <div className="text-lg font-semibold text-ink sm:text-xl">Bluesky Ops</div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-black/70 sm:text-sm">
        <span className="rounded-full bg-black/5 px-3 py-1 break-all">{email ?? "Signed in"}</span>
        <Button variant="ghost" size="sm" onClick={onSignOut} className="w-full sm:w-auto">
          Sign out
        </Button>
      </div>
    </header>
  );
}
