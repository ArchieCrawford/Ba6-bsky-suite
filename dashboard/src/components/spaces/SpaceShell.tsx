"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useSpace } from "@/lib/spaces/useSpace";
import { withAuthFetch } from "@/lib/withAuthFetch";
import { toast } from "sonner";

type SpaceShellProps = {
  spaceId: string;
  active: "chat" | "threads" | "digest" | "members" | "settings";
  children: ReactNode;
};

const tabLabel = {
  chat: "Chat",
  threads: "Threads",
  digest: "Digest",
  members: "Members",
  settings: "Settings"
} as const;

export function SpaceShell({ spaceId, active, children }: SpaceShellProps) {
  const { space, membership, loading, error, refresh } = useSpace(spaceId);
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const router = useRouter();

  const tabs = useMemo(
    () => [
      { key: "chat", href: `/spaces/${spaceId}/chat` },
      { key: "threads", href: `/spaces/${spaceId}/threads` },
      { key: "digest", href: `/spaces/${spaceId}/digest` },
      { key: "members", href: `/spaces/${spaceId}/members` },
      { key: "settings", href: `/spaces/${spaceId}/settings` }
    ],
    [spaceId]
  );

  const handleJoin = async () => {
    if (!space) return;
    setJoining(true);
    try {
      const res = await withAuthFetch("/api/spaces/join", {
        method: "POST",
        body: JSON.stringify({
          space_id: space.id,
          invite_code: inviteCode.trim() || undefined
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? payload?.reason ?? "Unable to join space");
      }
      toast.success(payload?.pending ? "Join request submitted" : "Joined space");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Join failed");
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    const isUuid =
      typeof spaceId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(spaceId);
    if (!isUuid) return;
    if (!space?.slug || space.slug === spaceId) return;
    router.replace(`/spaces/${space.slug}/${active}`);
  }, [spaceId, space?.slug, active, router]);

  if (loading) {
    return (
      <Card>
        <LoadingState label="Loading space..." />
      </Card>
    );
  }

  if (error || !space) {
    return (
      <Card>
        <ErrorState title="Space unavailable" subtitle={error ?? "Space not found"} />
      </Card>
    );
  }

  const isMember = membership?.status === "active";
  const isOwnerOrAdmin = membership?.role === "owner" || membership?.role === "admin";

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Space</p>
            <h1 className="text-2xl font-semibold">{space.name}</h1>
            {space.description ? (
              <p className="text-sm text-muted-foreground">{space.description}</p>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">
            Join mode: <span className="font-medium text-foreground">{space.join_mode}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`rounded-full border px-3 py-1 text-sm ${
                active === tab.key ? "border-foreground text-foreground" : "border-muted text-muted-foreground"
              }`}
            >
              {tabLabel[tab.key as keyof typeof tabLabel]}
            </Link>
          ))}
        </div>
      </Card>

      {!isMember ? (
        <Card className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Join this space</h2>
            <p className="text-sm text-muted-foreground">
              Spaces gate participation. You can view details, but you must join to send messages or create threads.
            </p>
          </div>
          {space.join_mode === "invite_only" ? (
            <Input
              placeholder="Invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          ) : null}
          <Button onClick={handleJoin} disabled={joining}>
            {space.join_mode === "moderated" ? "Request to join" : "Join space"}
          </Button>
          {space.join_mode === "moderated" ? (
            <p className="text-xs text-muted-foreground">
              Moderated spaces require approval. You’ll see access once a moderator approves your request.
            </p>
          ) : null}
        </Card>
      ) : null}

      {isMember ? children : null}

      {isMember && active === "settings" && !isOwnerOrAdmin ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Settings are limited to space owners and admins. Ask an owner to update the space configuration.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
