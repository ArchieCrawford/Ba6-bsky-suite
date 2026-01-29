"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { withAuthFetch } from "@/lib/withAuthFetch";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
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

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [joinMode, setJoinMode] = useState<SpaceRow["join_mode"]>("public");
  const [creating, setCreating] = useState(false);

  const [joinInput, setJoinInput] = useState("");
  const [joinMethod, setJoinMethod] = useState<"invite" | "id">("invite");
  const [joining, setJoining] = useState(false);

  const loadSpaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: listError } = await supabase
        .from("spaces")
        .select("id,name,slug,description,join_mode,created_at")
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

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Space name is required");
      return;
    }
    const slugValue = normalizeSlug(slug || trimmedName);
    if (!slugValue) {
      toast.error("Space slug is required");
      return;
    }
    setCreating(true);
    try {
      const res = await withAuthFetch("/api/spaces/create", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          slug: slugValue,
          description: description.trim() || null,
          join_mode: joinMode
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Unable to create space");
      }
      toast.success("Space created");
      setName("");
      setSlug("");
      setDescription("");
      setJoinMode("public");
      await loadSpaces();
    } catch (err: any) {
      toast.error(err?.message ?? "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    const value = joinInput.trim();
    if (!value) {
      toast.error("Enter an invite code or Space ID");
      return;
    }
    setJoining(true);
    try {
      const res = await withAuthFetch("/api/spaces/join", {
        method: "POST",
        body: JSON.stringify(joinMethod === "invite" ? { invite_code: value } : { space_id: value })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? payload?.reason ?? "Unable to join");
      }
      toast.success(payload?.pending ? "Join request submitted" : "Joined space");
      setJoinInput("");
      await loadSpaces();
    } catch (err: any) {
      toast.error(err?.message ?? "Join failed");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <h1 className="text-2xl font-semibold">Spaces</h1>
        <p className="text-sm text-muted-foreground">
          Spaces are the home for chat, threads, and digest tools. Create one for each group, topic, or workflow.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold">Create a space</h2>
          <Input placeholder="Space name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="Slug (optional)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <Textarea
            placeholder="Short description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Join mode</label>
          <Select value={joinMode} onChange={(e) => setJoinMode(e.target.value as SpaceRow["join_mode"])}>
            <option value="public">Public</option>
            <option value="moderated">Moderated</option>
            <option value="invite_only">Invite only</option>
          </Select>
          <Button onClick={handleCreate} disabled={creating}>
            Create space
          </Button>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Join a space</h2>
          <p className="text-sm text-muted-foreground">
            If you have an invite code or a Space ID, enter it here to request access.
          </p>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Join using</label>
          <Select value={joinMethod} onChange={(e) => setJoinMethod(e.target.value as "invite" | "id")}>
            <option value="invite">Invite code</option>
            <option value="id">Space ID</option>
          </Select>
          <Input
            placeholder={joinMethod === "invite" ? "Invite code" : "Space ID"}
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
          />
          <Button onClick={handleJoin} disabled={joining}>
            Join space
          </Button>
        </Card>
      </div>

      {loading ? (
        <Card>
          <LoadingState label="Loading spaces..." />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState title="Spaces unavailable" subtitle={error} />
        </Card>
      ) : spaces.length === 0 ? (
        <Card>
          <EmptyState
            title="No spaces yet"
            subtitle="Create your first space to start messaging, threads, and digest workflows."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {spaces.map((space) => (
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
              <div className="pt-2">
                <Link href={`/spaces/${space.id}/chat`}>
                  <Button variant="secondary">Open space</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
