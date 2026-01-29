"use client";

import { useEffect, useMemo, useState } from "react";
import { SpaceShell } from "@/components/spaces/SpaceShell";
import { supabase } from "@/lib/supabaseClient";
import { withAuthFetch } from "@/lib/withAuthFetch";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "sonner";
import { useSpace } from "@/lib/spaces/useSpace";

type GateRow = {
  id: string;
  gate_type: string;
  mode: string | null;
  config: Record<string, any>;
  is_enabled: boolean;
};

const SPACE_GATE_ACTIONS = [
  { id: "join", label: "Join space" },
  { id: "send_message", label: "Send messages" },
  { id: "create_thread", label: "Create threads" },
  { id: "configure_digest", label: "Configure digest" },
  { id: "invite_members", label: "Invite members" },
  { id: "moderate", label: "Moderate members" }
];

const normalizeActions = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

export default function SpaceSettingsPage({ params }: { params: { id: string } }) {
  const spaceId = params.id;
  const { space, membership, refresh } = useSpace(spaceId);
  const [joinMode, setJoinMode] = useState<"public" | "moderated" | "invite_only">("public");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [gates, setGates] = useState<GateRow[]>([]);
  const [gateType, setGateType] = useState("pay_gate");
  const [gateMode, setGateMode] = useState<string>("public");
  const [gateActions, setGateActions] = useState<string[]>([]);
  const [gateConfig, setGateConfig] = useState<Record<string, any>>({});
  const [editingGateId, setEditingGateId] = useState<string | null>(null);

  const isOwnerOrAdmin = membership?.role === "owner" || membership?.role === "admin";

  useEffect(() => {
    if (!space) return;
    setJoinMode(space.join_mode);
    setDescription(space.description ?? "");
  }, [space]);

  const loadGates = async () => {
    try {
      const res = await withAuthFetch(`/api/spaces/${spaceId}/gates`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to load gates");
      setGates(payload?.gates ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load gates");
    }
  };

  useEffect(() => {
    if (!isOwnerOrAdmin) return;
    void loadGates();
  }, [spaceId, isOwnerOrAdmin]);

  const handleSaveSpace = async () => {
    if (!space) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("spaces")
        .update({ join_mode: joinMode, description: description.trim() || null })
        .eq("id", space.id);
      if (error) throw error;
      toast.success("Space settings saved");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    try {
      const res = await withAuthFetch("/api/spaces/invites/create", {
        method: "POST",
        body: JSON.stringify({ space_id: spaceId })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Invite failed");
      setInviteCode(payload?.code ?? null);
    } catch (err: any) {
      toast.error(err?.message ?? "Invite failed");
    }
  };

  const resetGateForm = () => {
    setEditingGateId(null);
    setGateType("pay_gate");
    setGateMode("public");
    setGateActions([]);
    setGateConfig({});
  };

  const handleSaveGate = async () => {
    try {
      const config: Record<string, any> = { ...gateConfig, gate_actions: gateActions };
      if (gateType === "pay_gate") {
        config.provider = "stripe";
      }
      if (gateType === "hashtag_opt_in") {
        config.enrollment_tag = typeof config.enrollment_tag === "string" ? config.enrollment_tag.trim() : "";
        config.submission_tag = typeof config.submission_tag === "string" ? config.submission_tag.trim() : "";
      }
      const res = await withAuthFetch(`/api/spaces/${spaceId}/gates`, {
        method: "POST",
        body: JSON.stringify({
          gateId: editingGateId ?? undefined,
          gateType,
          mode: gateType === "hashtag_opt_in" ? gateMode : null,
          config,
          isEnabled: true
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Gate save failed");
      toast.success("Gate saved");
      resetGateForm();
      await loadGates();
    } catch (err: any) {
      toast.error(err?.message ?? "Gate save failed");
    }
  };

  const handleEditGate = (gate: GateRow) => {
    setEditingGateId(gate.id);
    setGateType(gate.gate_type);
    setGateMode(gate.mode ?? "public");
    const actions = normalizeActions(gate.config?.gate_actions ?? gate.config?.action);
    setGateActions(actions);
    setGateConfig(gate.config ?? {});
  };

  const handleDeleteGate = async (gateId: string) => {
    try {
      const res = await withAuthFetch(`/api/spaces/${spaceId}/gates`, {
        method: "DELETE",
        body: JSON.stringify({ gateId })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Delete failed");
      await loadGates();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  };

  const gateActionOptions = useMemo(() => SPACE_GATE_ACTIONS, []);

  return (
    <SpaceShell spaceId={spaceId} active="settings">
      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Space settings</h2>
          <Textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!isOwnerOrAdmin}
          />
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Join mode</label>
          <Select value={joinMode} onChange={(e) => setJoinMode(e.target.value as typeof joinMode)}>
            <option value="public">Public</option>
            <option value="moderated">Moderated</option>
            <option value="invite_only">Invite only</option>
          </Select>
          <Button onClick={handleSaveSpace} disabled={saving || !isOwnerOrAdmin}>
            Save settings
          </Button>
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Invite link</h3>
          <p className="text-sm text-muted-foreground">
            Generate a code for invite-only access. Share it with trusted members.
          </p>
          <Button onClick={handleInvite} disabled={!isOwnerOrAdmin}>
            Create invite code
          </Button>
          {inviteCode ? (
            <div className="rounded-md border px-3 py-2 text-sm">
              <p className="text-xs text-muted-foreground">Invite code</p>
              <p className="font-mono text-sm">{inviteCode}</p>
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Gating</h2>
          <p className="text-sm text-muted-foreground">
            Gates control who can join and which actions are enabled inside this space.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
          <div className="space-y-3">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Gate type</label>
            <Select value={gateType} onChange={(e) => setGateType(e.target.value)}>
              <option value="pay_gate">Pay gate</option>
              <option value="token_gate">Token gate</option>
              <option value="hashtag_opt_in">Hashtag opt-in</option>
            </Select>

            {gateType === "pay_gate" ? (
              <>
                <Input
                  placeholder="Stripe price_id"
                  value={gateConfig.price_id ?? ""}
                  onChange={(e) => setGateConfig({ ...gateConfig, price_id: e.target.value })}
                />
                <Input
                  placeholder="Entitlement lookup_key"
                  value={gateConfig.lookup_key ?? ""}
                  onChange={(e) => setGateConfig({ ...gateConfig, lookup_key: e.target.value })}
                />
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Billing mode</label>
                <Select
                  value={gateConfig.billing_mode === "subscription" ? "subscription" : "one_time"}
                  onChange={(e) =>
                    setGateConfig({
                      ...gateConfig,
                      billing_mode: e.target.value === "subscription" ? "subscription" : "one_time",
                      provider: "stripe"
                    })
                  }
                >
                  <option value="one_time">One-time</option>
                  <option value="subscription">Subscription</option>
                </Select>
              </>
            ) : null}

            {gateType === "token_gate" ? (
              <>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Chain</label>
                <Select value={gateConfig.chain ?? "evm"} onChange={(e) => setGateConfig({ ...gateConfig, chain: e.target.value })}>
                  <option value="evm">EVM</option>
                  <option value="solana">Solana</option>
                </Select>
                <Input
                  placeholder="Token contract / mint"
                  value={gateConfig.token ?? ""}
                  onChange={(e) => setGateConfig({ ...gateConfig, token: e.target.value })}
                />
                <Input
                  placeholder="Minimum balance"
                  value={gateConfig.min_balance ?? "1"}
                  onChange={(e) => setGateConfig({ ...gateConfig, min_balance: e.target.value })}
                />
              </>
            ) : null}

            {gateType === "hashtag_opt_in" ? (
              <>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Mode</label>
                <Select value={gateMode} onChange={(e) => setGateMode(e.target.value)}>
                  <option value="public">Public</option>
                  <option value="moderated">Moderated</option>
                </Select>
                <Input
                  placeholder="Enrollment tag (#AddToSpace)"
                  value={gateConfig.enrollment_tag ?? ""}
                  onChange={(e) => setGateConfig({ ...gateConfig, enrollment_tag: e.target.value })}
                />
                <Input
                  placeholder="Submission tag (#Space)"
                  value={gateConfig.submission_tag ?? ""}
                  onChange={(e) => setGateConfig({ ...gateConfig, submission_tag: e.target.value })}
                />
              </>
            ) : null}

            <div>
              <p className="text-xs text-muted-foreground">Gate actions</p>
              <div className="mt-2 space-y-2">
                {gateActionOptions.map((action) => (
                  <label key={action.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={gateActions.includes(action.id)}
                      onChange={(e) => {
                        setGateActions((prev) =>
                          e.target.checked ? [...prev, action.id] : prev.filter((item) => item !== action.id)
                        );
                      }}
                    />
                    {action.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveGate} disabled={!isOwnerOrAdmin}>
                {editingGateId ? "Update gate" : "Add gate"}
              </Button>
              {editingGateId ? (
                <Button variant="secondary" onClick={resetGateForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Active gates</h3>
            {gates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No gates configured yet.</p>
            ) : (
              gates.map((gate) => (
                <div key={gate.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{gate.gate_type}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => handleEditGate(gate)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleDeleteGate(gate.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Actions: {normalizeActions(gate.config?.gate_actions ?? gate.config?.action).join(", ") || "None"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </SpaceShell>
  );
}
