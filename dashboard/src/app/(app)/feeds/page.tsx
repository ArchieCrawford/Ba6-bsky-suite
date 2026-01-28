"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MobileCard } from "@/components/ui/MobileCard";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { toast } from "sonner";

const keywordToList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const listToKeyword = (list: string[]) => list.join(", ");

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matchesKeyword = (text: string, keyword: string, caseInsensitive = true) => {
  const trimmed = keyword.trim();
  if (!trimmed) return false;
  const pattern = new RegExp(`(^|\\W)${escapeRegExp(trimmed)}($|\\W)`, caseInsensitive ? "i" : undefined);
  return pattern.test(text);
};

const matchesTag = (text: string, tag: string, caseInsensitive = true) => {
  const trimmed = tag.trim();
  if (!trimmed) return false;
  const pattern = new RegExp(`(^|\\W)#?${escapeRegExp(trimmed)}($|\\W)`, caseInsensitive ? "i" : undefined);
  return pattern.test(text);
};

const normalizeTag = (value: string) => value.trim().replace(/^#+/, "").replace(/\s+/g, "");

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const resolveHandleToDid = async (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("did:")) return trimmed;
  const res = await fetch(
    `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(trimmed)}`
  );
  if (!res.ok) throw new Error("Could not resolve handle to DID");
  const payload = (await res.json().catch(() => ({}))) as { did?: string };
  return payload?.did ?? null;
};

type FeedRow = {
  id: string;
  slug: string;
  title: string | null;
  display_name: string | null;
  description: string | null;
  is_enabled: boolean;
};

type SourceRow = { source_type: string; account_did: string | null };

type AccountRow = { account_did: string; handle: string | null };

type RuleRow = {
  id: string;
  include_keywords: string[];
  exclude_keywords: string[];
  lang: string | null;
  source_strategy: string | null;
  include_mode: string | null;
  case_insensitive: boolean | null;
  opt_in_enabled: boolean | null;
  opt_in_mode: string | null;
  opt_in_tag: string | null;
  submit_enabled: boolean | null;
  submit_tag: string | null;
};

type TestRow = {
  uri: string;
  created_at: string;
  text: string;
  reason: string;
  included: boolean;
};

type TabKey = "basics" | "sources" | "rules" | "publish";

export default function FeedsPage() {
  const [feeds, setFeeds] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"slug" | "status">("slug");
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("basics");

  const [ruleId, setRuleId] = useState<string | null>(null);
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");
  const [lang, setLang] = useState("");
  const [includeMode, setIncludeMode] = useState<"any" | "all">("any");
  const [caseInsensitive, setCaseInsensitive] = useState(true);
  const [sourceStrategy, setSourceStrategy] = useState<"curated" | "opt_in">("curated");
  const [optInEnabled, setOptInEnabled] = useState(false);
  const [optInMode, setOptInMode] = useState<"public" | "moderated">("public");
  const [optInTag, setOptInTag] = useState("");
  const [submitEnabled, setSubmitEnabled] = useState(false);
  const [submitTag, setSubmitTag] = useState("");

  const [sources, setSources] = useState<SourceRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedAccountDid, setSelectedAccountDid] = useState("");
  const [sourceAccountDid, setSourceAccountDid] = useState("");
  const [newSource, setNewSource] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [removingSource, setRemovingSource] = useState<string | null>(null);

  const [testSlug, setTestSlug] = useState("");
  const [testResults, setTestResults] = useState<TestRow[]>([]);
  const [testing, setTesting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingFeed, setSavingFeed] = useState(false);

  const [createSlug, setCreateSlug] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [creatingFeed, setCreatingFeed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const filteredFeeds = useMemo(() => {
    const term = search.toLowerCase();
    let filtered = feeds;
    if (term) {
      filtered = feeds.filter((feed) => {
        return (
          feed.slug.toLowerCase().includes(term) ||
          (feed.title ?? feed.display_name ?? "").toLowerCase().includes(term) ||
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

  const selectedFeed = useMemo(() => feeds.find((feed) => feed.id === selectedFeedId) ?? null, [feeds, selectedFeedId]);

  const loadFeeds = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: feedError } = await supabase
        .from("feeds")
        .select("id,slug,title,display_name,description,is_enabled")
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
      setSourceAccountDid((current) => {
        if (rows.some((account) => account.account_did === current)) {
          return current;
        }
        return rows[0]?.account_did ?? "";
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load accounts");
      setAccounts([]);
      setSelectedAccountDid("");
      setSourceAccountDid("");
    }
  };

  const loadRulesAndSources = async (feedId: string) => {
    try {
      const { data: ruleRow, error: ruleError } = await supabase
        .from("feed_rules")
        .select(
          "id,include_keywords,exclude_keywords,lang,source_strategy,include_mode,case_insensitive,opt_in_enabled,opt_in_mode,opt_in_tag,submit_enabled,submit_tag"
        )
        .eq("feed_id", feedId)
        .maybeSingle();
      if (ruleError) throw ruleError;
      if (ruleRow) {
        const row = ruleRow as RuleRow;
        setRuleId(row.id);
        setInclude(listToKeyword(row.include_keywords ?? []));
        setExclude(listToKeyword(row.exclude_keywords ?? []));
        setLang(row.lang ?? "");
        setSourceStrategy((row.source_strategy as "curated" | "opt_in") ?? "curated");
        setIncludeMode((row.include_mode as "any" | "all") ?? "any");
        setCaseInsensitive(row.case_insensitive ?? true);
        setOptInEnabled(row.opt_in_enabled ?? false);
        setOptInMode((row.opt_in_mode as "public" | "moderated") ?? "public");
        setOptInTag(row.opt_in_tag ? normalizeTag(row.opt_in_tag) : "");
        setSubmitEnabled(row.submit_enabled ?? false);
        setSubmitTag(row.submit_tag ? normalizeTag(row.submit_tag) : "");
      } else {
        setRuleId(null);
        setInclude("");
        setExclude("");
        setLang("");
        setSourceStrategy("curated");
        setIncludeMode("any");
        setCaseInsensitive(true);
        setOptInEnabled(false);
        setOptInMode("public");
        setOptInTag("");
        setSubmitEnabled(false);
        setSubmitTag("");
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
      const cleanedOptInTag = normalizeTag(optInTag);
      const cleanedSubmitTag = normalizeTag(submitTag);
      const payload = {
        feed_id: selectedFeedId,
        rule_type: "keyword",
        include_keywords: keywordToList(include),
        exclude_keywords: keywordToList(exclude),
        lang: lang.trim() || null,
        source_strategy: sourceStrategy,
        include_mode: includeMode,
        case_insensitive: caseInsensitive,
        opt_in_enabled: sourceStrategy === "opt_in" ? optInEnabled : false,
        opt_in_mode: optInMode,
        opt_in_tag:
          sourceStrategy === "opt_in" && optInEnabled && cleanedOptInTag ? cleanedOptInTag : null,
        submit_enabled: sourceStrategy === "opt_in" ? submitEnabled : false,
        submit_tag:
          sourceStrategy === "opt_in" && submitEnabled && cleanedSubmitTag ? cleanedSubmitTag : null
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
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save rules");
    }
  };

  const addSource = async (value: string) => {
    if (!selectedFeedId) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    setAddingSource(true);
    try {
      const did = await resolveHandleToDid(trimmed);
      if (!did) throw new Error("Unable to resolve to DID");
      const { error: insertError } = await supabase.from("feed_sources").insert({
        feed_id: selectedFeedId,
        source_type: "account_list",
        account_did: did
      });
      if (insertError) {
        if (String(insertError.code) === "23505") {
          toast.message("Source already added");
        } else {
          throw insertError;
        }
      } else {
        toast.success("Source added");
      }
      setNewSource("");
      await loadRulesAndSources(selectedFeedId);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add source");
    } finally {
      setAddingSource(false);
    }
  };

  const removeSource = async (did: string) => {
    if (!selectedFeedId) return;
    if (!confirm(`Remove ${did} from this feed?`)) return;
    setRemovingSource(did);
    try {
      const { error: deleteError } = await supabase
        .from("feed_sources")
        .delete()
        .eq("feed_id", selectedFeedId)
        .eq("account_did", did);
      if (deleteError) throw deleteError;
      toast.success("Source removed");
      await loadRulesAndSources(selectedFeedId);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to remove source");
    } finally {
      setRemovingSource(null);
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
        .select(
          "include_keywords,exclude_keywords,lang,include_mode,case_insensitive,submit_enabled,submit_tag"
        )
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
      const includeModeValue = (ruleRow?.include_mode ?? "any") as "any" | "all";
      const caseInsensitiveValue = ruleRow?.case_insensitive ?? true;
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

      let candidatePosts = (posts ?? []) as any[];

      if (ruleRow?.submit_enabled && ruleRow.submit_tag) {
        let submitQuery = supabase
          .from("indexed_posts")
          .select("uri,created_at,text,author_did")
          .order("created_at", { ascending: false })
          .order("uri", { ascending: false })
          .limit(50);
        if (ruleRow?.lang) submitQuery = submitQuery.eq("lang", ruleRow.lang);
        submitQuery = submitQuery.ilike("text", `%${ruleRow.submit_tag}%`);
        const { data: submitPosts, error: submitError } = await submitQuery;
        if (submitError) throw submitError;
        const combined = [...candidatePosts, ...(submitPosts ?? [])];
        const deduped = new Map<string, any>();
        for (const row of combined) {
          if (!deduped.has(row.uri)) deduped.set(row.uri, row);
        }
        candidatePosts = Array.from(deduped.values());
      }

      const results = candidatePosts
        .map((post: any) => {
          const text = String(post.text ?? "");
          const matchedInclude = includeKeywords.filter((k) => matchesKeyword(text, k, caseInsensitiveValue));
          const matchedExclude = excludeKeywords.filter((k) => matchesKeyword(text, k, caseInsensitiveValue));
          const passesInclude =
            includeKeywords.length === 0 ||
            (includeModeValue === "all" ? matchedInclude.length === includeKeywords.length : matchedInclude.length > 0);
          const passesExclude = matchedExclude.length === 0;

          let included = passesInclude && passesExclude;
          let reason = "";

          if (ruleRow?.submit_enabled && ruleRow.submit_tag && matchesTag(text, ruleRow.submit_tag, true)) {
            included = passesExclude;
            reason = `Included via submit tag #${normalizeTag(ruleRow.submit_tag)}`;
          } else if (!passesExclude) {
            reason = `Excluded: ${matchedExclude.join(", ")}`;
          } else if (!passesInclude) {
            reason = includeModeValue === "all" ? "Missing required keywords" : "Missing include keywords";
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
        })
        .sort((a, b) => {
          if (a.created_at === b.created_at) return b.uri.localeCompare(a.uri);
          return b.created_at.localeCompare(a.created_at);
        });

      setTestResults(results);
    } catch (err: any) {
      toast.error(err?.message ?? "Test failed");
      setTestResults([]);
    } finally {
      setTesting(false);
    }
  };

  const saveFeedDetails = async () => {
    if (!selectedFeed) return;
    const titleValue = editTitle.trim();
    const descriptionValue = editDescription.trim();
    setSavingFeed(true);
    try {
      const { error: updateError } = await supabase
        .from("feeds")
        .update({
          title: titleValue || null,
          display_name: titleValue || null,
          description: descriptionValue || null
        })
        .eq("id", selectedFeed.id);
      if (updateError) throw updateError;
      toast.success("Feed details updated");
      await loadFeeds();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update feed");
    } finally {
      setSavingFeed(false);
    }
  };

  const createFeed = async () => {
    const slug = normalizeSlug(createSlug);
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      toast.error("Provide a slug using letters, numbers, or dashes.");
      return;
    }
    if (feeds.some((feed) => feed.slug === slug)) {
      toast.error("That slug already exists.");
      return;
    }
    const titleValue = createTitle.trim();
    const descriptionValue = createDescription.trim();
    setCreatingFeed(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Missing user session");

      const { data: insertRow, error: insertError } = await supabase
        .from("feeds")
        .insert({
          user_id: userId,
          slug,
          title: titleValue || null,
          display_name: titleValue || null,
          description: descriptionValue || null,
          is_enabled: true
        })
        .select("id,slug")
        .single();
      if (insertError) throw insertError;

      toast.success("Feed created");
      setCreateSlug("");
      setCreateTitle("");
      setCreateDescription("");
      setShowCreate(false);
      await loadFeeds();
      if (insertRow?.id) {
        setSelectedFeedId(insertRow.id);
        setTestSlug(insertRow.slug);
        setActiveTab("basics");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create feed");
    } finally {
      setCreatingFeed(false);
    }
  };

  useEffect(() => {
    loadFeeds();
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedFeedId) {
      loadRulesAndSources(selectedFeedId);
    }
  }, [selectedFeedId]);

  useEffect(() => {
    if (!selectedFeed) {
      setEditTitle("");
      setEditDescription("");
      return;
    }
    setEditTitle(selectedFeed.title ?? selectedFeed.display_name ?? "");
    setEditDescription(selectedFeed.description ?? "");
    setTestSlug(selectedFeed.slug);
    setActiveTab("basics");
  }, [selectedFeed]);

  if (loading) return <LoadingState label="Loading feeds" />;
  if (error) return <ErrorState title="Feeds unavailable" subtitle={error} onRetry={loadFeeds} />;

  const feedLabel = selectedFeed?.title ?? selectedFeed?.display_name ?? selectedFeed?.slug ?? "";

  const joinPreview = optInTag
    ? `To join, post a message with #${normalizeTag(optInTag)} and mention the BA6 join account.`
    : "Add an enrollment tag to generate join instructions.";

  const submitPreview = submitTag
    ? `To submit a single post, include #${normalizeTag(submitTag)} in the post text.`
    : "Add a submission tag to enable single-post submissions.";

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-none sm:bg-transparent sm:px-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-black/40">Feeds</div>
            <div className="text-sm text-black/60">Build, publish, and test custom feed generators.</div>
          </div>
          <Button variant="ghost" size="sm" onClick={loadFeeds} className="w-auto sm:hidden">
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <div className="text-xs font-semibold uppercase tracking-wide text-black/50">How to make a feed</div>
        <div className="mt-3 grid gap-3 text-sm text-black/70 sm:grid-cols-2">
          <div className="rounded-xl border border-black/10 bg-white/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-black/50">1. Create</div>
            <div className="mt-1">Pick a slug and name for the feed.</div>
          </div>
          <div className="rounded-xl border border-black/10 bg-white/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-black/50">2. Sources</div>
            <div className="mt-1">Choose curated accounts or opt-in tags.</div>
          </div>
          <div className="rounded-xl border border-black/10 bg-white/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-black/50">3. Rules</div>
            <div className="mt-1">Add keywords, exclusions, and language.</div>
          </div>
          <div className="rounded-xl border border-black/10 bg-white/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-black/50">4. Publish & test</div>
            <div className="mt-1">Publish the generator and run a test query.</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Create a feed</div>
            <div className="text-xs text-black/50">Feeds are per-user and live at /app.bsky.feed.generator/&lt;slug&gt;.</div>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
            New feed
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Your feeds</div>
            <div className="text-xs text-black/50">Select a feed to edit its configuration.</div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search feeds"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-xs"
            />
            <Select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as "slug" | "status")}
              className="min-h-[44px] sm:max-w-[160px]"
            >
              <option value="slug">Sort: slug</option>
              <option value="status">Sort: status</option>
            </Select>
            <Button variant="ghost" size="sm" onClick={loadFeeds} className="w-full sm:w-auto">
              Refresh
            </Button>
          </div>
        </div>

        {filteredFeeds.length === 0 ? (
          <EmptyState title="No feeds" subtitle="Create a feed to start building your generator." />
        ) : (
          <>
            <div className="mt-4 space-y-3 sm:hidden">
              {filteredFeeds.map((feed) => {
                const label = feed.title ?? feed.display_name ?? "Untitled feed";
                return (
                  <MobileCard
                    key={feed.id}
                    title={label}
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
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full"
                            onClick={() => setSelectedFeedId(feed.id)}
                          >
                            Edit feed
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
                );
              })}
            </div>

            <div className="mt-4 hidden divide-y divide-black/5 sm:block">
              {filteredFeeds.map((feed) => {
                const label = feed.title ?? feed.display_name ?? "Untitled feed";
                return (
                  <div key={feed.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">{label}</div>
                      <div className="text-xs text-black/50">/{feed.slug}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setSelectedFeedId(feed.id)}>
                        Edit feed
                      </Button>
                      <Button variant={feed.is_enabled ? "ghost" : "primary"} size="sm" onClick={() => toggleFeed(feed)}>
                        {feed.is_enabled ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {!selectedFeed ? (
        <Card>
          <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Select a feed</div>
          <div className="mt-2 text-sm text-black/60">Choose a feed above to configure sources, rules, and publishing.</div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-ink">{feedLabel || "Untitled feed"}</div>
                <div className="text-xs text-black/50">/{selectedFeed.slug}</div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                    selectedFeed.is_enabled
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  {selectedFeed.is_enabled ? "Enabled" : "Disabled"}
                </span>
                <Button size="sm" variant="ghost" onClick={() => toggleFeed(selectedFeed)}>
                  {selectedFeed.is_enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            {([
              ["basics", "Basics"],
              ["sources", "Sources"],
              ["rules", "Rules"],
              ["publish", "Publish & Test"]
            ] as [TabKey, string][]).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={activeTab === key ? "primary" : "ghost"}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          {activeTab === "basics" && (
            <Card>
              <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Basics</div>
              <div className="mt-2 text-xs text-black/50">Edit the feed name and description.</div>
              <div className="mt-4 grid gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Feed name</label>
                  <Input
                    placeholder="BA6 - Systems Notes"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    disabled={!selectedFeed}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Description</label>
                  <Input
                    placeholder="Optional description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    disabled={!selectedFeed}
                  />
                </div>
                <div className="text-xs text-black/50">Slug: /{selectedFeed.slug}</div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button size="sm" onClick={saveFeedDetails} disabled={!selectedFeed || savingFeed} className="w-full sm:w-auto">
                    {savingFeed ? "Saving..." : "Save basics"}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "sources" && (
            <Card>
              <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Sources</div>
              <div className="mt-2 text-xs text-black/50">Choose how accounts are enrolled into this feed.</div>

              <div className="mt-4 grid gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Source strategy</label>
                  <Select
                    value={sourceStrategy}
                    onChange={(e) => setSourceStrategy(e.target.value as "curated" | "opt_in")}
                    className="min-h-[44px]"
                  >
                    <option value="curated">Curated list (manual)</option>
                    <option value="opt_in">Opt-in via hashtag</option>
                  </Select>
                  <div className="mt-1 text-[11px] text-black/40">
                    Curated lists are controlled by you. Opt-in allows accounts to enroll themselves.
                  </div>
                </div>

                {sourceStrategy === "curated" ? (
                  <div className="grid gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Add from connected account</label>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Select
                          value={sourceAccountDid}
                          onChange={(e) => setSourceAccountDid(e.target.value)}
                          className="min-h-[44px]"
                        >
                          {accounts.length === 0 ? (
                            <option value="">No connected accounts</option>
                          ) : (
                            accounts.map((account) => (
                              <option key={account.account_did} value={account.account_did}>
                                {account.handle ?? account.account_did}
                              </option>
                            ))
                          )}
                        </Select>
                        <Button
                          size="sm"
                          onClick={() => addSource(sourceAccountDid)}
                          disabled={!sourceAccountDid || addingSource}
                          className="w-full sm:w-auto"
                        >
                          {addingSource ? "Adding..." : "Add"}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Add by handle or DID</label>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          placeholder="handle.bsky.social or did:plc..."
                          value={newSource}
                          onChange={(e) => setNewSource(e.target.value)}
                        />
                        <Button
                          size="sm"
                          onClick={() => addSource(newSource)}
                          disabled={!newSource.trim() || addingSource}
                          className="w-full sm:w-auto"
                        >
                          {addingSource ? "Adding..." : "Add"}
                        </Button>
                      </div>
                      <div className="mt-1 text-[11px] text-black/40">Handles will be resolved to DIDs automatically.</div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 rounded-xl border border-black/10 bg-white/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-black/50">Opt-in enrollment</div>
                        <div className="text-xs text-black/50">Allow others to join this feed via a tag.</div>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs text-black/60">
                        <input
                          type="checkbox"
                          checked={optInEnabled}
                          onChange={(e) => setOptInEnabled(e.target.checked)}
                          className="h-4 w-4"
                        />
                        Enable opt-in
                      </label>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Enrollment tag</label>
                      <Input
                        placeholder="AddToSystems"
                        value={optInTag}
                        onChange={(e) => setOptInTag(e.target.value)}
                      />
                      <div className="mt-1 text-[11px] text-black/40">Store without #. Default is case-insensitive.</div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Enrollment mode</label>
                      <Select
                        value={optInMode}
                        onChange={(e) => setOptInMode(e.target.value as "public" | "moderated")}
                        className="min-h-[44px]"
                      >
                        <option value="public">Public (auto-approve)</option>
                        <option value="moderated">Moderated (requires approval)</option>
                      </Select>
                    </div>
                    <div className="rounded-lg border border-black/10 bg-white/80 p-3 text-xs text-black/60">
                      {joinPreview}
                    </div>
                    <div className="border-t border-black/10 pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-black/50">Submission tag</div>
                          <div className="text-xs text-black/50">Allow single posts to be submitted via tag.</div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-black/60">
                          <input
                            type="checkbox"
                            checked={submitEnabled}
                            onChange={(e) => setSubmitEnabled(e.target.checked)}
                            className="h-4 w-4"
                          />
                          Enable submission
                        </label>
                      </div>
                      <div className="mt-2">
                        <Input
                          placeholder="SubmitSystems"
                          value={submitTag}
                          onChange={(e) => setSubmitTag(e.target.value)}
                        />
                      </div>
                      <div className="mt-2 rounded-lg border border-black/10 bg-white/80 p-3 text-xs text-black/60">
                        {submitPreview}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-black/50">Current sources</div>
                  {sources.length === 0 ? (
                    <div className="mt-2 text-xs text-black/50">No sources configured yet.</div>
                  ) : (
                    <ul className="mt-2 space-y-2 text-xs text-black/60">
                      {sources.map((source) => (
                        <li
                          key={`${source.account_did}-${source.source_type}`}
                          className="flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-white/70 px-3 py-2"
                        >
                          <span>{source.account_did ?? "(self)"}</span>
                          {source.account_did && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeSource(source.account_did ?? "")}
                              disabled={removingSource === source.account_did}
                            >
                              {removingSource === source.account_did ? "Removing..." : "Remove"}
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Button size="sm" onClick={saveRules} className="w-full sm:w-auto">
                  Save source settings
                </Button>
              </div>
            </Card>
          )}

          {activeTab === "rules" && (
            <Card>
              <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Rules</div>
              <div className="mt-2 text-xs text-black/50">Filter posts using include/exclude keywords.</div>
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

                <details className="rounded-xl border border-black/10 bg-white/70 px-4 py-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-black/50">
                    Advanced options
                  </summary>
                  <div className="mt-3 grid gap-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Include mode</label>
                      <Select
                        value={includeMode}
                        onChange={(e) => setIncludeMode(e.target.value as "any" | "all")}
                        className="min-h-[44px]"
                      >
                        <option value="any">Match any include keyword</option>
                        <option value="all">Match all include keywords</option>
                      </Select>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-black/60">
                      <input
                        type="checkbox"
                        checked={caseInsensitive}
                        onChange={(e) => setCaseInsensitive(e.target.checked)}
                        className="h-4 w-4"
                      />
                      Case-insensitive matching
                    </label>
                  </div>
                </details>

                <Button size="sm" onClick={saveRules} disabled={!selectedFeedId} className="w-full sm:w-auto">
                  Save rules
                </Button>
              </div>
            </Card>
          )}

          {activeTab === "publish" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Publish</div>
                <div className="mt-2 text-xs text-black/50">Publish the feed generator record to Bluesky.</div>
                {accounts.length === 0 ? (
                  <div className="mt-2 text-xs text-black/50">Connect a Bluesky account to publish this feed.</div>
                ) : (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={selectedAccountDid}
                      onChange={(e) => setSelectedAccountDid(e.target.value)}
                      className="min-h-[44px] sm:max-w-[240px]"
                    >
                      {accounts.map((account) => (
                        <option key={account.account_did} value={account.account_did}>
                          {account.handle ?? account.account_did}
                        </option>
                      ))}
                    </Select>
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
                <div className="mt-3 text-xs text-black/50">Creates or updates the feed generator record for this feed.</div>

                <div className="mt-6 rounded-xl border border-black/10 bg-white/70 p-4 text-xs text-black/60">
                  <div className="font-semibold uppercase tracking-wide text-black/50">Empty feed?</div>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>Make sure sources are configured (or opt-in tags are active).</li>
                    <li>Check that posts are indexed (scheduled posts show instantly).</li>
                    <li>Verify include/exclude keywords match recent posts.</li>
                    <li>Use the test button to preview what the feed sees.</li>
                  </ul>
                </div>
              </Card>

              <Card>
                <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Test feed</div>
                <div className="mt-4 space-y-3">
                  <Select
                    value={testSlug}
                    onChange={(e) => setTestSlug(e.target.value)}
                    className="min-h-[44px]"
                  >
                    {feeds.map((feed) => (
                      <option key={feed.slug} value={feed.slug}>
                        {feed.slug}
                      </option>
                    ))}
                  </Select>
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
          )}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create a new feed">
        <div className="grid gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Slug</label>
            <Input
              placeholder="e.g. market-notes"
              value={createSlug}
              onChange={(e) => setCreateSlug(e.target.value)}
            />
            <div className="mt-1 text-[11px] text-black/40">
              Letters, numbers, and dashes only. This becomes the feed URL.
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Feed name (optional)</label>
            <Input
              placeholder="BA6 - Market Notes"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Description (optional)</label>
            <Input
              placeholder="Short summary"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="sm" onClick={createFeed} disabled={creatingFeed} className="w-full sm:w-auto">
              {creatingFeed ? "Creating..." : "Create feed"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
