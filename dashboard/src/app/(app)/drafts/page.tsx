"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { toast } from "sonner";

type DraftRow = {
  id: string;
  text: string;
  created_at: string;
};

type AccountRow = { id: string; account_did: string; handle: string | null };

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<DraftRow | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [runAt, setRunAt] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const uid = userData.user?.id;
      if (!uid) throw new Error("Missing user session");
      setUserId(uid);

      const { data: draftRows, error: draftError } = await supabase
        .from("drafts")
        .select("id,text,created_at")
        .order("created_at", { ascending: false });
      if (draftError) throw draftError;
      setDrafts((draftRows ?? []) as DraftRow[]);

      const { data: accountRows, error: accountError } = await supabase
        .from("accounts")
        .select("id,account_did,handle")
        .order("created_at", { ascending: false });
      if (accountError) throw accountError;
      setAccounts((accountRows ?? []) as AccountRow[]);
      if (accountRows?.length) {
        setSelectedAccountId(accountRows[0].id);
      }
    } catch (err: any) {
      const message = err?.message ?? "Failed to load drafts";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const createDraft = async () => {
    if (!userId) return;
    if (!text.trim()) {
      toast.error("Draft text is required");
      return;
    }
    try {
      const { error: insertError } = await supabase.from("drafts").insert({
        user_id: userId,
        text: text.trim()
      });
      if (insertError) throw insertError;
      toast.success("Draft saved");
      setText("");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save draft");
    }
  };

  const openSchedule = (draft: DraftRow) => {
    setSelectedDraft(draft);
    setRunAt("");
    setModalOpen(true);
  };

  const scheduleDraft = async () => {
    if (!userId || !selectedDraft) return;
    const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
    if (!selectedAccount) {
      toast.error("Choose a Bluesky account");
      return;
    }
    if (!runAt) {
      toast.error("Pick a run time");
      return;
    }

    try {
      const { error: scheduleError } = await supabase.from("scheduled_posts").insert({
        user_id: userId,
        account_id: selectedAccount.id,
        account_did: selectedAccount.account_did,
        draft_id: selectedDraft.id,
        run_at: new Date(runAt).toISOString(),
        max_attempts: 5,
        status: "queued"
      });
      if (scheduleError) throw scheduleError;
      toast.success("Scheduled post queued");
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to schedule");
    }
  };

  const filteredDrafts = useMemo(() => {
    const term = search.toLowerCase();
    let filtered = drafts;
    if (term) {
      filtered = drafts.filter((draft) => {
        return draft.text.toLowerCase().includes(term) || draft.id.includes(term);
      });
    }
    return [...filtered].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [drafts, search]);

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <LoadingState label="Loading drafts" />;
  if (error) return <ErrorState title="Drafts unavailable" subtitle={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      <Card>
        <div className="text-sm font-semibold uppercase tracking-wide text-black/50">New draft</div>
        <div className="mt-4 grid gap-4">
          <Textarea
            rows={6}
            placeholder="Write the post copy..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button onClick={createDraft}>Save draft</Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Drafts</div>
          <Input
            placeholder="Search drafts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="ghost" size="sm" onClick={loadData}>
            Refresh
          </Button>
        </div>

        {filteredDrafts.length === 0 ? (
          <EmptyState title="No drafts" subtitle="Drafts you create will appear here." />
        ) : (
          <div className="divide-y divide-black/5">
            {filteredDrafts.map((draft) => (
              <div key={draft.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <div className="text-sm font-semibold text-ink">
                    {draft.text.split("\n")[0]?.slice(0, 80) || "Untitled"}
                  </div>
                  <div className="mt-1 text-sm text-black/60">{draft.text}</div>
                  <div className="mt-2 text-xs text-black/40">
                    {format(new Date(draft.created_at), "MMM d, yyyy HH:mm")}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => openSchedule(draft)}>
                  Schedule
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Schedule draft">
        <div className="space-y-4 text-sm">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.handle ?? account.account_did}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Run at</label>
            <Input type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={scheduleDraft}>
              Schedule
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
