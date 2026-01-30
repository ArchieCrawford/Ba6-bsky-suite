import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSupabase } from "../lib/supabase";
import { fetchIdentity, IdentityRow } from "../lib/identity";
import { Space } from "../types/models";
import { apiFetch } from "../lib/api";

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

const mockSpaces: Space[] = [
  { id: "space_demo_1", name: "BA6 HQ", slug: "ba6-hq", is_gated: false, is_member: true, unread_count: 2 },
  { id: "space_demo_2", name: "Creators", slug: "creators", is_gated: true, is_member: false, unread_count: 0 },
  { id: "space_demo_3", name: "Operators", slug: "operators", is_gated: false, is_member: true, unread_count: 5 }
];

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [identity, setIdentity] = useState<IdentityRow | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(null);

  const refreshIdentity = async () => {
    const res = await fetchIdentity();
    if (res.ok) setIdentity(res.data);
  };

  const refreshSpaces = async () => {
    const res = await apiFetch<{ spaces: Space[] }>("/api/spaces/list", { method: "GET" });
    if (res.ok && Array.isArray(res.data?.spaces)) {
      setSpaces(res.data.spaces);
      if (!currentSpaceId && res.data.spaces[0]?.id) setCurrentSpaceId(res.data.spaces[0].id);
      return;
    }
    setSpaces(mockSpaces);
    if (!currentSpaceId) setCurrentSpaceId(mockSpaces[0].id);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const sess = data.session;
      setHasSession(Boolean(sess));
      setEmail(sess?.user?.email ?? null);
      await refreshSpaces();
      if (sess) await refreshIdentity();
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setHasSession(Boolean(session));
      setEmail(session?.user?.email ?? null);
      await refreshSpaces();
      if (session) await refreshIdentity();
      else setIdentity(null);
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
