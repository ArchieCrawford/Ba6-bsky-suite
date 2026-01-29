"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { withAuthFetch } from "@/lib/withAuthFetch";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { toast } from "sonner";

type SpaceRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  join_mode: "public" | "moderated" | "invite_only";
  created_at: string;
};

export default function SpacesDiscoverPage() {
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  const loadSpaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: listError } = await supabase
        .from("spaces")
        .select("id,name,slug,description,join_mode,created_at")
        .in("join_mode", ["public", "moderated"])
        .order("created_at", { ascending: false });
      if (listError) throw listError;
      setSpaces((data ?? []) as SpaceRow[]);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load spaces");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSpaces();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return spaces;
    return spaces.filter((space) => {
      return (
        space.name.toLowerCase().includes(term) ||
        space.slug.toLowerCase().includes(term) ||
        (space.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [spaces, search]);

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Discover spaces</h1>
            <p className="text-sm text-muted-foreground">
              Browse public and moderated spaces. Join to start chatting or creating threads.
            </p>
          </div>
          <Link href="/spaces">
            <Button variant="secondary">Back to my spaces</Button>
          </Link>
        </div>
        <Input
          placeholder="Search by name or slug"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      {loading ? (
        <Card>
          <LoadingState label="Loading spaces" />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState title="Spaces unavailable" subtitle={error} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState title="No public spaces yet" subtitle="Check back soon or create one." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((space) => (
            <Card key={space.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{space.name}</h3>
                  <p className="text-xs text-muted-foreground">/{space.slug}</p>
                </div>
                <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                  {space.join_mode}
                </span>
              </div>
              {space.description ? (
                <p className="text-sm text-muted-foreground">{space.description}</p>
              ) : null}
              <div className="rounded-lg border border-dashed border-black/10 bg-white/60 px-3 py-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">/{space.slug}</div>
                <div className="mt-1 break-all">Share: {`/spaces/${space.slug}/chat`}</div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Link href={`/spaces/${space.id}/chat`}>
                  <Button variant="secondary">Open space</Button>
                </Link>
                <Button
                  variant="ghost"
                  disabled={joiningId === space.id || joinedIds.has(space.id)}
                  onClick={async () => {
                    setJoiningId(space.id);
                    try {
                      const res = await withAuthFetch("/api/spaces/join", {
                        method: "POST",
                        body: JSON.stringify({ space_id: space.id })
                      });
                      const payload = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        throw new Error(payload?.error ?? payload?.reason ?? "Unable to join");
                      }
                      toast.success(payload?.pending ? "Join request submitted" : "Joined space");
                      setJoinedIds((prev) => new Set(prev).add(space.id));
                    } catch (err: any) {
                      if (String(err?.message ?? "").includes("Missing session")) {
                        toast.message("Sign in to join spaces");
                        router.push("/login");
                      } else {
                        toast.error(err?.message ?? "Join failed");
                      }
                    } finally {
                      setJoiningId(null);
                    }
                  }}
                >
                  {joinedIds.has(space.id)
                    ? "Joined"
                    : joiningId === space.id
                      ? "Joining..."
                      : space.join_mode === "moderated"
                        ? "Request to join"
                        : "Join"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
