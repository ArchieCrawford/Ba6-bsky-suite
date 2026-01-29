import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type SpaceRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  join_mode: "public" | "moderated" | "invite_only";
  owner_user_id: string;
};

export type SpaceMembership = {
  role: "owner" | "admin" | "member";
  status: "active" | "banned";
};

type UseSpaceState = {
  space: SpaceRow | null;
  membership: SpaceMembership | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useSpace(spaceId: string): UseSpaceState {
  const [space, setSpace] = useState<SpaceRow | null>(null);
  const [membership, setMembership] = useState<SpaceMembership | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const isUuid =
        typeof spaceId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(spaceId);
      if (!isUuid) {
        setSpace(null);
        setMembership(null);
        setUserId(null);
        setError("Invalid space id");
        return;
      }
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setUserId(null);
        setMembership(null);
        setSpace(null);
        setError("Not signed in");
        return;
      }
      setUserId(userData.user.id);

      const { data: spaceRow, error: spaceError } = await supabase
        .from("spaces")
        .select("id,name,slug,description,join_mode,owner_user_id")
        .eq("id", spaceId)
        .maybeSingle();
      if (spaceError) throw spaceError;
      setSpace(spaceRow ? (spaceRow as SpaceRow) : null);

      const { data: memberRow, error: memberError } = await supabase
        .from("space_members")
        .select("role,status")
        .eq("space_id", spaceId)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (memberError) throw memberError;
      setMembership(memberRow ? (memberRow as SpaceMembership) : null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load space");
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { space, membership, userId, loading, error, refresh: load };
}
