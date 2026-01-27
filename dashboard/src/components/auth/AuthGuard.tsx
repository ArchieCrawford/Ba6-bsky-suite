"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { toast } from "sonner";
import { ensureUserProfile } from "@/lib/ensureUserProfile";
import { linkPendingWallets } from "@/lib/db";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const bootstrap = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!mountedRef.current) return;
      if (error) throw error;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const profile = await ensureUserProfile();
      if (!mountedRef.current) return;
      if (!profile.ok) {
        setProfileError(profile.error);
        return;
      }
      const linked = await linkPendingWallets();
      if (!linked.ok) {
        toast.error(linked.error ?? "Wallet linking failed");
      }
      setProfileError(null);
      setReady(true);
    } catch (err: any) {
      if (!mountedRef.current) return;
      toast.error(err?.message ?? "Unable to validate session");
    }
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;
    setReady(false);
    setProfileError(null);
    bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      bootstrap();
    });

    return () => {
      mountedRef.current = false;
      subscription.subscription.unsubscribe();
    };
  }, [bootstrap, router]);

  if (profileError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <ErrorState
          title="Profile missing"
          subtitle="We couldn't create your profile. Please retry or contact an admin."
          onRetry={() => {
            setReady(false);
            setProfileError(null);
            bootstrap();
          }}
        />
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Verifying session" />
      </div>
    );
  }

  return <>{children}</>;
}
