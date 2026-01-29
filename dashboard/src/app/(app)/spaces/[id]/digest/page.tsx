"use client";

import { useEffect, useState } from "react";
import { SpaceShell } from "@/components/spaces/SpaceShell";
import { supabase } from "@/lib/supabaseClient";
import { withAuthFetch } from "@/lib/withAuthFetch";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "sonner";

type DigestRow = {
  include_keywords: string[];
  exclude_keywords: string[];
  lang: string | null;
  include_mode: "any" | "all";
  case_insensitive: boolean;
  sources: Array<{ type: string; did: string }>;
};

const listToCsv = (list: string[]) => list.join(", ");
const csvToList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function SpaceDigestPage({ params }: { params: { id: string } }) {
  const spaceId = params.id;
  const [digest, setDigest] = useState<DigestRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [sourcesInput, setSourcesInput] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("space_digests")
        .select("include_keywords,exclude_keywords,lang,include_mode,case_insensitive,sources")
        .eq("space_id", spaceId)
        .maybeSingle();
      if (!error && data) {
        const row = data as DigestRow;
        setDigest(row);
        const sources = Array.isArray(row.sources)
          ? row.sources.map((s) => (s?.did ? String(s.did) : "")).filter(Boolean)
          : [];
        setSourcesInput(sources.join(", "));
      } else if (!data) {
        setDigest({
          include_keywords: [],
          exclude_keywords: [],
          lang: null,
          include_mode: "any",
          case_insensitive: true,
          sources: []
        });
      }
    };
    void load();
  }, [spaceId]);

  const handleSave = async () => {
    if (!digest) return;
    setSaving(true);
    try {
      const sources = csvToList(sourcesInput).map((did) => ({ type: "account_list", did }));
      const res = await withAuthFetch("/api/spaces/digest/save", {
        method: "POST",
        body: JSON.stringify({
          space_id: spaceId,
          include_keywords: digest.include_keywords,
          exclude_keywords: digest.exclude_keywords,
          lang: digest.lang,
          include_mode: digest.include_mode,
          case_insensitive: digest.case_insensitive,
          sources
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? payload?.reason ?? "Unable to save digest");
      }
      toast.success("Digest saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!digest) {
    return (
      <SpaceShell spaceId={spaceId} active="digest">
        <Card>Loading digest...</Card>
      </SpaceShell>
    );
  }

  return (
    <SpaceShell spaceId={spaceId} active="digest">
      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Digest builder</h2>
          <Input
            placeholder="Source DIDs (comma separated)"
            value={sourcesInput}
            onChange={(e) => setSourcesInput(e.target.value)}
          />
          <Input
            placeholder="Include keywords (comma separated)"
            value={listToCsv(digest.include_keywords)}
            onChange={(e) => setDigest({ ...digest, include_keywords: csvToList(e.target.value) })}
          />
          <Input
            placeholder="Exclude keywords (comma separated)"
            value={listToCsv(digest.exclude_keywords)}
            onChange={(e) => setDigest({ ...digest, exclude_keywords: csvToList(e.target.value) })}
          />
          <Input
            placeholder="Language filter (optional)"
            value={digest.lang ?? ""}
            onChange={(e) => setDigest({ ...digest, lang: e.target.value.trim() || null })}
          />
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Include mode</label>
          <Select
            value={digest.include_mode}
            onChange={(e) => setDigest({ ...digest, include_mode: e.target.value as "any" | "all" })}
          >
            <option value="any">Any match</option>
            <option value="all">All keywords</option>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={digest.case_insensitive}
              onChange={(e) => setDigest({ ...digest, case_insensitive: e.target.checked })}
            />
            Case insensitive matching
          </label>
          <Button onClick={handleSave} disabled={saving}>
            Save digest
          </Button>
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">How it works</h3>
          <p className="text-sm text-muted-foreground">
            The digest lets you curate a “best-of” list for the space. Add source DIDs and filter by keywords.
          </p>
          <p className="text-sm text-muted-foreground">
            Digest configuration is gated. If you see a payment or wallet prompt, unlock access first.
          </p>
        </Card>
      </div>
    </SpaceShell>
  );
}
