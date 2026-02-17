import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSupabase } from "../lib/supabase";
import type { IdentityRow } from "../lib/identity";
import type { Space } from "../types/models";

type Ctx = {
  ready: boolean;
  hasSession: boolean;
  email: string | null;
  identity: IdentityRow | null;
  spaces: Space[];
  currentSpaceId: string | null;
  setCurrentSpaceId: (id: string) => void;
  refreshIdentity: () => Promise<void>;
  refreshSpaces: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [identity, setIdentity] = useState<IdentityRow | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(null);

  const refreshIdentity = async () => {
    setIdentity(null);
  };

  const refreshSpaces = async () => {
    setSpaces([]);
    if (currentSpaceId) setCurrentSpaceId(null);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const sess = data.session;
      setHasSession(Boolean(sess));
      setEmail(sess?.user?.email ?? null);
      if (!sess) setIdentity(null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setHasSession(Boolean(session));
      setEmail(session?.user?.email ?? null);
      if (!session) setIdentity(null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({
      ready,
      hasSession,
      email,
      identity,
      spaces,
      currentSpaceId,
      setCurrentSpaceId,
      refreshIdentity,
      refreshSpaces,
      signOut
    }),
    [ready, hasSession, email, identity, spaces, currentSpaceId]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("AppState missing");
  return ctx;
}
