"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/States";
import { withAuthFetch } from "@/lib/withAuthFetch";
import { useIdentity } from "@/lib/identity/useIdentity";
import { toast } from "sonner";

type ConvoRow = {
  id: string;
  members?: Array<{ did?: string; handle?: string | null }>;
  lastMessage?: { text?: string };
  unreadCount?: number;
  status?: string;
};

type MessageRow = {
  id: string;
  text: string;
  sentAt: string;
  sender?: { did?: string; handle?: string | null };
};

const displayActor = (actor?: { did?: string; handle?: string | null }) => {
  if (!actor) return "Unknown";
  if (actor.handle) return `@${actor.handle}`;
  return actor.did ?? "Unknown";
};

export default function MessagesPage() {
  const { identity } = useIdentity();
  const [convos, setConvos] = useState<ConvoRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [newBody, setNewBody] = useState("");

  const selfDid = identity?.did ?? null;

  const convoLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const convo of convos) {
      const members = convo.members ?? [];
      const other = selfDid ? members.find((m) => m.did && m.did !== selfDid) : members[0];
      map.set(convo.id, displayActor(other));
    }
    return map;
  }, [convos, selfDid]);

  const loadConvos = async () => {
    setLoadingConvos(true);
    setError(null);
    setNeedsAuth(false);
    try {
      const res = await withAuthFetch("/api/chat/convos");
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (payload?.reason === "bluesky_auth_required") {
          setNeedsAuth(true);
          return;
        }
        throw new Error(payload?.error ?? "Failed to load conversations");
      }
      const items = (payload?.convos ?? []) as ConvoRow[];
      setConvos(items);
      if (!selectedId && items.length) {
        setSelectedId(items[0].id);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load conversations");
    } finally {
      setLoadingConvos(false);
    }
  };

  const loadMessages = async (convoId: string) => {
    setLoadingMessages(true);
    try {
      const res = await withAuthFetch(`/api/chat/convo/${convoId}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (payload?.reason === "bluesky_auth_required") {
          setNeedsAuth(true);
          return;
        }
        throw new Error(payload?.error ?? "Failed to load messages");
      }
      setMessages((payload?.messages ?? []) as MessageRow[]);
      await withAuthFetch("/api/chat/mark-read", {
        method: "POST",
        body: JSON.stringify({ convoId })
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadConvos();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId);
    }
  }, [selectedId]);

  const handleSend = async () => {
    if (!selectedId) return;
    const text = composerText.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await withAuthFetch("/api/chat/send", {
        method: "POST",
        body: JSON.stringify({ convoId: selectedId, text })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? payload?.reason ?? "Send failed");
      }
      setComposerText("");
      await loadMessages(selectedId);
      await loadConvos();
    } catch (err: any) {
      toast.error(err?.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  };

  const handleNewMessage = async () => {
    const text = newBody.trim();
    const target = recipient.trim();
    if (!target || !text) return;
    setSending(true);
    try {
      const res = await withAuthFetch("/api/chat/send", {
        method: "POST",
        body: JSON.stringify({ recipient: target, text })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? payload?.reason ?? "Send failed");
      }
      setRecipient("");
      setNewBody("");
      setShowNew(false);
      if (payload?.convo_id) {
        setSelectedId(payload.convo_id);
      }
      await loadConvos();
    } catch (err: any) {
      toast.error(err?.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (loadingConvos) {
    return <LoadingState label="Loading conversations" />;
  }

  if (error) {
    return <ErrorState title="Messages unavailable" subtitle={error} onRetry={loadConvos} />;
  }

  if (needsAuth) {
    return (
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Connect Bluesky to use DMs</h2>
        <p className="text-sm text-muted-foreground">
          Direct Messages require a Bluesky session. Connect a Bluesky account to enable chat.
        </p>
        <Button asChild>
          <a href="/accounts">Connect Bluesky</a>
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr,1.4fr]">
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Messages</div>
            <h2 className="text-lg font-semibold">Conversations</h2>
          </div>
          <Button size="sm" onClick={() => setShowNew(true)}>
            New message
          </Button>
        </div>
        {convos.length === 0 ? (
          <EmptyState title="No conversations" subtitle="Start a new DM to begin chatting." />
        ) : (
          <div className="space-y-2">
            {convos.map((convo) => (
              <button
                key={convo.id}
                onClick={() => setSelectedId(convo.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                  convo.id === selectedId ? "border-foreground" : "border-muted"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{convoLabel.get(convo.id) ?? "Conversation"}</div>
                  {convo.unreadCount ? (
                    <span className="rounded-full bg-black px-2 py-0.5 text-xs text-white">{convo.unreadCount}</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {convo.lastMessage?.text ? convo.lastMessage.text.slice(0, 80) : "No messages yet"}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex h-full flex-col space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Thread</div>
          <h2 className="text-lg font-semibold">
            {selectedId ? convoLabel.get(selectedId) ?? "Conversation" : "Select a conversation"}
          </h2>
        </div>

        {selectedId ? (
          <div className="flex-1 space-y-3 overflow-auto rounded-md border p-3">
            {loadingMessages ? (
              <LoadingState label="Loading messages" />
            ) : messages.length === 0 ? (
              <EmptyState title="No messages yet" subtitle="Start the conversation with a message." />
            ) : (
              messages
                .slice()
                .reverse()
                .map((msg) => {
                  const isSelf = selfDid && msg.sender?.did === selfDid;
                  return (
                    <div
                      key={msg.id}
                      className={`rounded-md px-3 py-2 text-sm ${
                        isSelf ? "ml-auto bg-black text-white" : "bg-muted/40"
                      }`}
                    >
                      <div className="text-xs opacity-70">
                        {displayActor(msg.sender)} · {new Date(msg.sentAt).toLocaleTimeString()}
                      </div>
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    </div>
                  );
                })
            )}
          </div>
        ) : (
          <EmptyState title="No conversation selected" subtitle="Pick a conversation to view messages." />
        )}

        {selectedId ? (
          <div className="space-y-2">
            <Textarea
              placeholder="Write a message..."
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
            />
            <Button onClick={handleSend} disabled={sending}>
              Send
            </Button>
          </div>
        ) : null}
      </Card>

      {showNew ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">New message</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>
                Close
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              <Input
                placeholder="Recipient @handle, DID, or username"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              <Textarea
                placeholder="Write your first message"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
              />
              <Button onClick={handleNewMessage} disabled={sending}>
                Send message
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
