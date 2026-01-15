"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { LoadingState } from "@/components/ui/States";
import { toast } from "sonner";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) throw error;
        if (!data.session) {
          router.replace("/login");
          return;
        }
        setReady(true);
      } catch (err: any) {
        if (!mounted) return;
        toast.error(err?.message ?? "Unable to validate session");
      }
    };
    checkSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Verifying session" />
      </div>
    );
  }

  return <>{children}</>;
}
