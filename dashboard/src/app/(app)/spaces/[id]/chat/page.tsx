"use client";

import { useEffect, useState } from "react";
import { SpaceShell } from "@/components/spaces/SpaceShell";
import { supabase } from "@/lib/supabaseClient";
import { withAuthFetch } from "@/lib/withAuthFetch";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { toast } from "sonner";

type MessageRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
};

export default function SpaceChatPage({ params }: { params: { id: string } }) {
  const spaceId = params.id;
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const loadMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("space_messages")
      .select("id,body,created_at,user_id")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) {
      setMessages((data ?? []) as MessageRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadMessages();
  }, [spaceId]);

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const res = await withAuthFetch("/api/spaces/messages/send", {
        method: "POST",
        body: JSON.stringify({ space_id: spaceId, body: trimmed })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? payload?.reason ?? "Unable to send message");
      }
      setBody("");
      await loadMessages();
    } catch (err: any) {
      toast.error(err?.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <SpaceShell spaceId={spaceId} active="chat">
      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Chat</h2>
          {loading ? (
            <LoadingState label="Loading messages..." />
          ) : messages.length === 0 ? (
            <EmptyState title="No messages yet" subtitle="Start the conversation for this space." />
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="rounded-md border px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground">{new Date(msg.created_at).toLocaleString()}</p>
                  <p className="mt-1 whitespace-pre-wrap">{msg.body}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Send a message</h3>
          <Textarea
            placeholder="Write a quick update..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button onClick={handleSend} disabled={sending}>
            Send message
          </Button>
          <p className="text-xs text-muted-foreground">
            Chat is gated by your space configuration. If you see a payment or wallet prompt, complete it first.
          </p>
        </Card>
      </div>
    </SpaceShell>
  );
}
