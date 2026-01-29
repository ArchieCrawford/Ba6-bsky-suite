"use client";

import { useEffect, useState } from "react";
import { withAuthFetch } from "@/lib/withAuthFetch";

export type IdentityRow = {
  did: string | null;
  handle: string | null;
  did_type: string | null;
  username?: string | null;
};

export function useIdentity() {
  const [identity, setIdentity] = useState<IdentityRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await withAuthFetch("/api/identity/me");
        const payload = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (!res.ok) {
          throw new Error(payload?.error ?? "Unable to load identity");
        }
        setIdentity(payload as IdentityRow);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Unable to load identity");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return { identity, loading, error };
}
