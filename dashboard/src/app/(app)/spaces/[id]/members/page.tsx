"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SpaceShell } from "@/components/spaces/SpaceShell";
import { supabase } from "@/lib/supabaseClient";
import { withAuthFetch } from "@/lib/withAuthFetch";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { toast } from "sonner";
import { useSpace } from "@/lib/spaces/useSpace";

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string;
};

type RequestRow = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
};

export default function SpaceMembersPage() {
  const params = useParams();
  const spaceKey = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const { membership, space } = useSpace(spaceKey);
  const resolvedId = space?.id ?? "";
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMembers = async () => {
    setLoading(true);
    const { data: memberData } = await supabase
      .from("space_members")
      .select("id,user_id,role,status,joined_at")
      .eq("space_id", resolvedId)
      .order("joined_at", { ascending: false });
    setMembers((memberData ?? []) as MemberRow[]);

    const { data: requestData } = await supabase
      .from("space_join_requests")
      .select("id,user_id,status,created_at")
      .eq("space_id", resolvedId)
      .order("created_at", { ascending: false });
    setRequests((requestData ?? []) as RequestRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!resolvedId) return;
    void loadMembers();
  }, [resolvedId]);

  const handleRequest = async (requestId: string, action: "approve" | "deny") => {
    try {
      const res = await withAuthFetch(`/api/spaces/requests/${action}`, {
        method: "POST",
        body: JSON.stringify({ request_id: requestId })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? payload?.reason ?? "Request failed");
      }
      await loadMembers();
    } catch (err: any) {
      toast.error(err?.message ?? "Update failed");
    }
  };

  const isOwnerOrAdmin = membership?.role === "owner" || membership?.role === "admin";

  return (
    <SpaceShell spaceId={spaceKey} active="members">
      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Members</h2>
          {loading ? (
            <LoadingState label="Loading members..." />
          ) : members.length === 0 ? (
            <EmptyState title="No members yet" subtitle="Invite teammates or approve join requests." />
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{member.user_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.role} · {member.status}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Join requests</h3>
          {!isOwnerOrAdmin ? (
            <p className="text-sm text-muted-foreground">Only owners and admins can review requests.</p>
          ) : requests.length === 0 ? (
            <EmptyState title="No requests" subtitle="Moderated join requests will appear here." />
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div key={req.id} className="rounded-md border px-3 py-2">
                  <p className="text-sm font-medium">{req.user_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {req.status} · {new Date(req.created_at).toLocaleString()}
                  </p>
                  {req.status === "pending" && isOwnerOrAdmin ? (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => handleRequest(req.id, "approve")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleRequest(req.id, "deny")}>
                        Deny
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </SpaceShell>
  );
}
