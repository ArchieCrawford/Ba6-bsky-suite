"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MobileCard } from "@/components/ui/MobileCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { toast } from "sonner";

const keywordToList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const listToKeyword = (list: string[]) => list.join(", ");

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matchesKeyword = (text: string, keyword: string) => {
  const trimmed = keyword.trim();
  if (!trimmed) return false;
  const pattern = new RegExp(`(^|\\W)${escapeRegExp(trimmed)}($|\\W)`, "i");
  return pattern.test(text);
};

type FeedRow = {
  id: string;
  slug: string;
  display_name: string | null;
  description: string | null;
  is_enabled: boolean;
};

type SourceRow = { source_type: string; account_did: string | null };
type AccountRow = { account_did: string; handle: string | null };

type TestRow = {
  uri: string;
  created_at: string;
  text: string;
  reason: string;
  included: boolean;
};

export default function FeedsPage() {
  const [feeds, setFeeds] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"slug" | "status">("slug");
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");
  const [lang, setLang] = useState("");
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedAccountDid, setSelectedAccountDid] = useState("");
  const [testSlug, setTestSlug] = useState("");
  const [testResults, setTestResults] = useState<TestRow[]>([]);
  const [testing, setTesting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const filteredFeeds = useMemo(() => {
    const term = search.toLowerCase();
    let filtered = feeds;
    if (term) {
      filtered = feeds.filter((feed) => {
        return (
          feed.slug.toLowerCase().includes(term) ||
          (feed.display_name ?? "").toLowerCase().includes(term) ||
          feed.description?.toLowerCase().includes(term)
        );
      });
    }
    return [...filtered].sort((a, b) => {
      if (sortKey === "status") {
        return Number(b.is_enabled) - Number(a.is_enabled);
      }
      return a.slug.localeCompare(b.slug);
    });
  }, [feeds, search, sortKey]);

  const loadFeeds = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: feedError } = await supabase
        .from("feeds")
        .select("id,slug,display_name,description,is_enabled")
        .order("created_at", { ascending: false });
      if (feedError) throw feedError;
      const feedRows = (data ?? []) as FeedRow[];
      setFeeds(feedRows);
      if (!selectedFeedId && feedRows.length) {
        setSelectedFeedId(feedRows[0].id);
        setTestSlug(feedRows[0].slug);
      }
    } catch (err: any) {
      const message = err?.message ?? "Failed to load feeds";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const { data, error: accountError } = await supabase
        .from("accounts")
        .select("account_did,handle")
        .order("created_at", { ascending: false });
      if (accountError) throw accountError;
      const rows = (data ?? []) as AccountRow[];
      setAccounts(rows);
      setSelectedAccountDid((current) => {
        if (rows.some((account) => account.account_did === current)) {
          return current;
        }
        return rows[0]?.account_did ?? "";
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load accounts");
      setAccounts([]);
      setSelectedAccountDid("");
    }
  };

  const loadRulesAndSources = async (feedId: string) => {
    try {
      const { data: ruleRow, error: ruleError } = await supabase
        .from("feed_rules")
        .select("id,include_keywords,exclude_keywords,lang")
        .eq("feed_id", feedId)
        .maybeSingle();
      if (ruleError) throw ruleError;
      if (ruleRow) {
        setRuleId(ruleRow.id);
        setInclude(listToKeyword(ruleRow.include_keywords ?? []));
        setExclude(listToKeyword(ruleRow.exclude_keywords ?? []));
        setLang(ruleRow.lang ?? "");
      } else {
        setRuleId(null);
        setInclude("");
        setExclude("");
        setLang("");
      }

      const { data: sourceRows, error: sourceError } = await supabase
        .from("feed_sources")
        .select("source_type,account_did")
        .eq("feed_id", feedId);
      if (sourceError) throw sourceError;
      setSources((sourceRows ?? []) as SourceRow[]);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load feed rules");
    }
  };

  const saveRules = async () => {
    if (!selectedFeedId) return;
    try {
      const payload = {
        feed_id: selectedFeedId,
        include_keywords: keywordToList(include),
        exclude_keywords: keywordToList(exclude),
        lang: lang.trim() || null
      };
      if (ruleId) {
        const { error: updateError } = await supabase.from("feed_rules").update(payload).eq("id", ruleId);
        if (updateError) throw updateError;
      } else {
        const { data: insertRow, error: insertError } = await supabase
          .from("feed_rules")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        setRuleId(insertRow.id);
      }
      toast.success("Rules saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save rules");
    }
  };

  const toggleFeed = async (feed: FeedRow) => {
    if (!confirm(`Turn ${feed.is_enabled ? "off" : "on"} feed ${feed.slug}?`)) return;
    try {
      const { error: toggleError } = await supabase
        .from("feeds")
        .update({ is_enabled: !feed.is_enabled })
        .eq("id", feed.id);
      if (toggleError) throw toggleError;
      toast.success("Feed updated");
      await loadFeeds();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update feed");
    }
  };

  const publishFeed = async () => {
    if (!selectedFeedId) {
      toast.error("Select a feed to publish");
      return;
    }
    if (!selectedAccountDid) {
      toast.error("Select a Bluesky account to publish");
      return;
    }
    setPublishing(true);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) {
        throw new Error("Missing session");
      }
      const res = await fetch("/api/feeds/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`
        },
        body: JSON.stringify({
          feedId: selectedFeedId,
          accountDid: selectedAccountDid
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to publish feed");
      }
      if (payload?.status === "unchanged") {
        toast.success("Feed already published");
      } else {
        toast.success("Feed published");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to publish feed");
    } finally {
      setPublishing(false);
    }
  };

  const runTest = async () => {
    if (!testSlug) return;
    setTesting(true);
    try {
      const { data: feedRow, error: feedError } = await supabase
        .from("feeds")
        .select("id,slug,is_enabled")
        .eq("slug", testSlug)
        .single();
      if (feedError) throw feedError;
      if (!feedRow?.is_enabled) {
        toast.error("Feed is disabled");
        setTestResults([]);
        return;
      }

      const { data: ruleRow, error: ruleError } = await supabase
        .from("feed_rules")
        .select("include_keywords,exclude_keywords,lang")
        .eq("feed_id", feedRow.id)
        .maybeSingle();
      if (ruleError) throw ruleError;

      const { data: sourceRows, error: sourceError } = await supabase
        .from("feed_sources")
        .select("source_type,account_did")
        .eq("feed_id", feedRow.id);
      if (sourceError) throw sourceError;

      const includeKeywords: string[] = (ruleRow?.include_keywords ?? []).map((k: string) => k.trim()).filter(Boolean);
      const excludeKeywords: string[] = (ruleRow?.exclude_keywords ?? []).map((k: string) => k.trim()).filter(Boolean);
      const authorDids = (sourceRows ?? [])
        .filter((s: any) => s.source_type === "account_list" && s.account_did)
        .map((s: any) => s.account_did);

      let query = supabase
        .from("indexed_posts")
        .select("uri,created_at,text,author_did")
        .order("created_at", { ascending: false })
        .order("uri", { ascending: false })
        .limit(50);

      if (authorDids.length) query = query.in("author_did", authorDids);
      if (ruleRow?.lang) query = query.eq("lang", ruleRow.lang);

      const { data: posts, error: postError } = await query;
      if (postError) throw postError;

      const results = (posts ?? []).map((post: any) => {
        const text = String(post.text ?? "");
        const matchedInclude = includeKeywords.filter((k) => matchesKeyword(text, k));
        const matchedExclude = excludeKeywords.filter((k) => matchesKeyword(text, k));
        const passesInclude = includeKeywords.length === 0 || matchedInclude.length > 0;
        const passesExclude = matchedExclude.length === 0;
        const included = passesInclude && passesExclude;
        let reason = "";
        if (!passesExclude) {
          reason = `Excluded: ${matchedExclude.join(", ")}`;
        } else if (!passesInclude) {
          reason = "Missing include keywords";
        } else if (matchedInclude.length) {
          reason = `Matched: ${matchedInclude.join(", ")}`;
        } else {
          reason = "Included: no include filter";
        }
        return {
          uri: post.uri,
          created_at: post.created_at,
          text: post.text,
          reason,
          included
        } as TestRow;
      });

      setTestResults(results);
    } catch (err: any) {
      toast.error(err?.message ?? "Test failed");
      setTestResults([]);
    } finally {
      setTesting(false);
    }
  };

  const selectedFeed = useMemo(() => feeds.find((feed) => feed.id === selectedFeedId) ?? null, [feeds, selectedFeedId]);

  useEffect(() => {
    loadFeeds();
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedFeedId) {
      loadRulesAndSources(selectedFeedId);
    }
  }, [selectedFeedId]);

  if (loading) return <LoadingState label="Loading feeds" />;
  if (error) return <ErrorState title="Feeds unavailable" subtitle={error} onRetry={loadFeeds} />;

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-none sm:bg-transparent sm:px-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-black/40">Feeds</div>
            <div className="text-sm text-black/60">Manage custom feed generators.</div>
          </div>
          <Button variant="ghost" size="sm" onClick={loadFeeds} className="w-auto sm:hidden">
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold uppercase tracking-wide text-black/60">
            What is a custom feed?
          </summary>
          <div className="mt-3 space-y-3 text-sm text-black/70">
            <p>A feed generator returns a list of post URIs (a feed skeleton) for custom feeds.</p>
            <p>
              Hydration into full post data happens elsewhere, while the rules decide which posts get included in the
              skeleton.
            </p>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-black/50">How to use this page</div>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-black/70">
                <li>Enable the feed.</li>
                <li>Set rules.</li>
                <li>Test feed.</li>
              </ol>
            </div>
          </div>
        </details>
      </Card>
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Feeds</div>
            <div className="text-xs text-black/50">Manage feed slugs and enablement.</div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search feeds"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-xs"
            />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as "slug" | "status")}
              className="min-h-[44px] w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm sm:max-w-[160px]"
            >
              <option value="slug">Sort: slug</option>
              <option value="status">Sort: status</option>
            </select>
            <Button variant="ghost" size="sm" onClick={loadFeeds} className="w-full sm:w-auto">
              Refresh
            </Button>
          </div>
        </div>

        {filteredFeeds.length === 0 ? (
          <EmptyState title="No feeds" subtitle="Create a feed in Supabase to manage it here." />
        ) : (
          <>
            <div className="mt-4 space-y-3 sm:hidden">
              {filteredFeeds.map((feed) => (
                <MobileCard
                  key={feed.id}
                  title={feed.display_name ?? "Untitled feed"}
                  subtitle={`/${feed.slug}`}
                  status={
                    <span className={`text-xs font-semibold ${feed.is_enabled ? "text-emerald-600" : "text-rose-600"}`}>
                      {feed.is_enabled ? "Enabled" : "Disabled"}
                    </span>
                  }
                  details={feed.description ? <div>{feed.description}</div> : <div>No description.</div>}
                  actions={
                    <details>
                      <summary
                        aria-label="More actions"
                        className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-black/10 bg-white/80 px-4 text-lg font-semibold text-black/60"
                      >
                        ⋯
                      </summary>
                      <div className="mt-2 grid gap-2">
                        <Button variant="secondary" size="sm" className="w-full" onClick={() => setSelectedFeedId(feed.id)}>
                          Edit rules
                        </Button>
                        <Button
                          variant={feed.is_enabled ? "ghost" : "primary"}
                          size="sm"
                          className="w-full"
                          onClick={() => toggleFeed(feed)}
                        >
                          {feed.is_enabled ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </details>
                  }
                />
              ))}
            </div>

            <div className="mt-4 hidden divide-y divide-black/5 sm:block">
              {filteredFeeds.map((feed) => (
                <div key={feed.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                  <div className="text-sm font-semibold text-ink">{feed.display_name ?? "Untitled feed"}</div>
                    <div className="text-xs text-black/50">/{feed.slug}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setSelectedFeedId(feed.id)}>
                      Edit rules
                    </Button>
                    <Button variant={feed.is_enabled ? "ghost" : "primary"} size="sm" onClick={() => toggleFeed(feed)}>
                      {feed.is_enabled ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Rules builder</div>
          <div className="mt-2 text-xs text-black/50">Feed: {selectedFeed?.slug ?? "Select a feed"}</div>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Include keywords</label>
              <Input value={include} onChange={(e) => setInclude(e.target.value)} placeholder="comma separated" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Exclude keywords</label>
              <Input value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="comma separated" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Language</label>
              <Input value={lang} onChange={(e) => setLang(e.target.value)} placeholder="Optional (en)" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveRules} disabled={!selectedFeedId} className="w-full sm:w-auto">
                Save rules
              </Button>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-black/50">Sources</div>
            {sources.length === 0 ? (
              <div className="mt-2 text-xs text-black/50">No sources configured.</div>
            ) : (
              <ul className="mt-2 space-y-2 text-xs text-black/60">
                {sources.map((source, index) => (
                  <li key={`${source.account_did}-${index}`} className="rounded-xl border border-black/10 bg-white/70 px-3 py-2">
                    {source.source_type} — {source.account_did ?? "(self)"}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-black/50">Publish feed</div>
            {accounts.length === 0 ? (
              <div className="mt-2 text-xs text-black/50">Connect a Bluesky account to publish this feed.</div>
            ) : (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={selectedAccountDid}
                  onChange={(e) => setSelectedAccountDid(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm sm:max-w-[220px]"
                >
                  {accounts.map((account) => (
                    <option key={account.account_did} value={account.account_did}>
                      {account.handle ?? account.account_did}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={publishFeed}
                  disabled={!selectedFeedId || !selectedAccountDid || publishing}
                  className="w-full sm:w-auto"
                >
                  {publishing ? "Publishing..." : "Publish feed"}
                </Button>
              </div>
            )}
            <div className="mt-2 text-xs text-black/50">Creates or updates the feed generator record for this feed.</div>
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Test feed</div>
          <div className="mt-4 space-y-3">
            <select
              value={testSlug}
              onChange={(e) => setTestSlug(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm"
            >
              {feeds.map((feed) => (
                <option key={feed.slug} value={feed.slug}>
                  {feed.slug}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={runTest} disabled={testing} className="w-full sm:w-auto">
              {testing ? "Running..." : "Run test"}
            </Button>
          </div>

          <div className="mt-6 space-y-3">
            {testResults.length === 0 ? (
              <div className="text-xs text-black/50">No test results yet.</div>
            ) : (
              testResults.map((row) => (
                <div
                  key={row.uri}
                  className={`rounded-xl border px-3 py-2 ${
                    row.included ? "border-emerald-100 bg-emerald-50" : "border-rose-100 bg-rose-50"
                  }`}
                >
                  <div className="text-xs text-black/40">{row.uri}</div>
                  <div className="mt-1 text-sm text-black/80">{row.text}</div>
                  <div className={`mt-1 text-xs ${row.included ? "text-emerald-700" : "text-rose-700"}`}>
                    {row.reason}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
