"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SpaceShell } from "@/components/spaces/SpaceShell";
import { supabase } from "@/lib/supabaseClient";
import { withAuthFetch } from "@/lib/withAuthFetch";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { toast } from "sonner";
import { useSpace } from "@/lib/spaces/useSpace";

type ThreadRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  user_id: string;
};

export default function SpaceThreadsPage() {
  const params = useParams();
  const spaceKey = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const { space } = useSpace(spaceKey);
  const resolvedId = space?.id ?? "";
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const loadThreads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("space_threads")
      .select("id,title,body,created_at,user_id")
      .eq("space_id", resolvedId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) {
      setThreads((data ?? []) as ThreadRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!resolvedId) return;
    void loadThreads();
  }, [resolvedId]);

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Title is required");
      return;
    }
    if (!resolvedId) {
      toast.error("Space not loaded");
      return;
    }
    setSaving(true);
    try {
      const res = await withAuthFetch("/api/spaces/threads/create", {
        method: "POST",
        body: JSON.stringify({ space_id: resolvedId, title: trimmedTitle, body: body.trim() || null })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? payload?.reason ?? "Unable to create thread");
      }
      setTitle("");
      setBody("");
      await loadThreads();
    } catch (err: any) {
      toast.error(err?.message ?? "Create failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SpaceShell spaceId={spaceKey} active="threads">
      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Threads</h2>
          {loading ? (
            <LoadingState label="Loading threads..." />
          ) : threads.length === 0 ? (
            <EmptyState title="No threads yet" subtitle="Create the first discussion thread for this space." />
          ) : (
            <div className="space-y-3">
              {threads.map((thread) => (
                <div key={thread.id} className="rounded-md border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{new Date(thread.created_at).toLocaleString()}</p>
                  <p className="text-sm font-semibold">{thread.title}</p>
                  {thread.body ? <p className="text-sm text-muted-foreground">{thread.body}</p> : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Start a thread</h3>
          <Input placeholder="Thread title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            placeholder="Optional context or notes"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button onClick={handleCreate} disabled={saving}>
            Create thread
          </Button>
        </Card>
      </div>
    </SpaceShell>
  );
}
