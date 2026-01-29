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
  include_mode: string | null;
  case_insensitive: boolean | null;
};

type TestRow = {
  uri: string;
  created_at: string;
  text: string;
  reason: string;
  included: boolean;
};

type GateRow = {
  id: string;
  feed_id: string;
  gate_type: string;
  mode: string | null;
  config: Record<string, any>;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type JoinRequestRow = {
  id: string;
  requester_did: string;
  status: string;
  created_at: string;
};

type GateFormState = {
  id?: string | null;
  gateType: "hashtag_opt_in" | "token_gate";
  mode: "public" | "moderated";
  isEnabled: boolean;
  enrollmentTag: string;
  submissionTag: string;
  requireMention: boolean;
  joinAccount: string;
  tokenChain: "base" | "solana";
  tokenAddress: string;
  minBalance: string;
  gateAction: "join" | "submit" | "premium_features";
};

type TabKey = "basics" | "sources" | "rules" | "gating" | "publish";

const defaultGateForm = (type: "hashtag_opt_in" | "token_gate" = "hashtag_opt_in"): GateFormState => ({
  gateType: type,
  mode: "public",
  isEnabled: true,
  enrollmentTag: "",
  submissionTag: "",
  requireMention: false,
  joinAccount: "",
  tokenChain: "base",
  tokenAddress: "",
  minBalance: "1",
  gateAction: "join"
});

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

  const [sources, setSources] = useState<SourceRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedAccountDid, setSelectedAccountDid] = useState("");
  const [sourceAccountDid, setSourceAccountDid] = useState("");
  const [newSource, setNewSource] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [removingSource, setRemovingSource] = useState<string | null>(null);

  const [gates, setGates] = useState<GateRow[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
  const [gateForm, setGateForm] = useState<GateFormState | null>(null);
  const [savingGate, setSavingGate] = useState(false);
  const [loadingGates, setLoadingGates] = useState(false);

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

  const withAuthFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const token = data.session?.access_token;
    if (!token) throw new Error("Missing session");
    return fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`
      }
    });
  };

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
        .select("id,include_keywords,exclude_keywords,lang,include_mode,case_insensitive")
        .eq("feed_id", feedId)
        .maybeSingle();
      if (ruleError) throw ruleError;
      if (ruleRow) {
        const row = ruleRow as RuleRow;
        setRuleId(row.id);
        setInclude(listToKeyword(row.include_keywords ?? []));
        setExclude(listToKeyword(row.exclude_keywords ?? []));
        setLang(row.lang ?? "");
        setIncludeMode((row.include_mode as "any" | "all") ?? "any");
        setCaseInsensitive(row.case_insensitive ?? true);
      } else {
        setRuleId(null);
        setInclude("");
        setExclude("");
        setLang("");
        setIncludeMode("any");
        setCaseInsensitive(true);
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

  const loadGates = async (feedId: string) => {
    setLoadingGates(true);
    try {
      const res = await withAuthFetch(`/api/feeds/${feedId}/gates`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load gates");
      }
      setGates(payload.gates ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load gates");
      setGates([]);
    } finally {
      setLoadingGates(false);
    }
  };

  const loadJoinRequests = async (feedId: string) => {
    try {
      const res = await withAuthFetch(`/api/feeds/${feedId}/join-requests`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load join requests");
      }
      setJoinRequests(payload.requests ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load join requests");
      setJoinRequests([]);
    }
  };

  const saveRules = async () => {
    if (!selectedFeedId) return;
    try {
      const payload = {
        feed_id: selectedFeedId,
        include_keywords: keywordToList(include),
        exclude_keywords: keywordToList(exclude),
        lang: lang.trim() || null,
        include_mode: includeMode,
        case_insensitive: caseInsensitive
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

  const saveGate = async () => {
    if (!selectedFeedId || !gateForm) return;
    setSavingGate(true);
    try {
      const config =
        gateForm.gateType === "hashtag_opt_in"
          ? {
              enrollment_tag: normalizeTag(gateForm.enrollmentTag),
              submission_tag: normalizeTag(gateForm.submissionTag),
              require_mention: gateForm.requireMention,
              join_account: gateForm.joinAccount.trim() || null
            }
          : {
              chain: gateForm.tokenChain,
              token: gateForm.tokenAddress.trim(),
              min_balance: Number(gateForm.minBalance || "1"),
              action: gateForm.gateAction
            };

      const res = await withAuthFetch(`/api/feeds/${selectedFeedId}/gates`, {
        method: "POST",
        body: JSON.stringify({
          gateId: gateForm.id ?? undefined,
          gateType: gateForm.gateType,
          mode: gateForm.gateType === "hashtag_opt_in" ? gateForm.mode : null,
          config,
          isEnabled: gateForm.isEnabled
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to save gate");
      }
      toast.success("Gate saved");
      setGateForm(null);
      await loadGates(selectedFeedId);
      await loadJoinRequests(selectedFeedId);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save gate");
    } finally {
      setSavingGate(false);
    }
  };

  const deleteGate = async (gateId: string) => {
    if (!selectedFeedId) return;
    if (!confirm("Remove this gate?")) return;
    try {
      const res = await withAuthFetch(`/api/feeds/${selectedFeedId}/gates`, {
        method: "DELETE",
        body: JSON.stringify({ gateId })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to delete gate");
      }
      toast.success("Gate removed");
      await loadGates(selectedFeedId);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete gate");
    }
  };

  const approveRequest = async (requestId: string) => {
    if (!selectedFeedId) return;
    try {
      const res = await withAuthFetch(`/api/feeds/${selectedFeedId}/join-requests`, {
        method: "POST",
        body: JSON.stringify({ action: "approve", requestId })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to approve");
      toast.success("Request approved");
      await loadJoinRequests(selectedFeedId);
      await loadRulesAndSources(selectedFeedId);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to approve request");
    }
  };

  const rejectRequest = async (requestId: string) => {
    if (!selectedFeedId) return;
    try {
      const res = await withAuthFetch(`/api/feeds/${selectedFeedId}/join-requests`, {
        method: "POST",
        body: JSON.stringify({ action: "reject", requestId })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to reject");
      toast.success("Request rejected");
      await loadJoinRequests(selectedFeedId);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to reject request");
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
        .select("include_keywords,exclude_keywords,lang,include_mode,case_insensitive")
        .eq("feed_id", feedRow.id)
        .maybeSingle();
      if (ruleError) throw ruleError;

      const { data: sourceRows, error: sourceError } = await supabase
        .from("feed_sources")
        .select("source_type,account_did")
        .eq("feed_id", feedRow.id);
      if (sourceError) throw sourceError;

      const { data: gateRows } = await supabase
        .from("feed_gates")
        .select("gate_type,config,is_enabled")
        .eq("feed_id", feedRow.id)
        .eq("is_enabled", true);

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

      const submitTags = (gateRows ?? [])
        .filter((gate: any) => gate.gate_type === "hashtag_opt_in")
        .map((gate: any) => String(gate.config?.submission_tag ?? "").trim())
        .filter(Boolean);

      if (submitTags.length) {
        let submitQuery = supabase
          .from("indexed_posts")
          .select("uri,created_at,text,author_did")
          .order("created_at", { ascending: false })
          .order("uri", { ascending: false })
          .limit(50);
        if (ruleRow?.lang) submitQuery = submitQuery.eq("lang", ruleRow.lang);
        submitQuery = submitQuery.ilike("text", `%${submitTags[0]}%`);
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

          const submitHit = submitTags.some((tag) => matchesTag(text, tag, true));
          if (submitHit) {
            included = passesExclude;
            reason = "Included via submit tag";
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
      loadGates(selectedFeedId);
      loadJoinRequests(selectedFeedId);
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

  useEffect(() => {
    if (!gateForm && gates.length) return;
  }, [gateForm, gates]);

  if (loading) return <LoadingState label="Loading feeds" />;
  if (error) return <ErrorState title="Feeds unavailable" subtitle={error} onRetry={loadFeeds} />;

  const feedLabel = selectedFeed?.title ?? selectedFeed?.display_name ?? selectedFeed?.slug ?? "";

  const gateJoinPreview = gateForm?.enrollmentTag
    ? `To join, post a message with #${normalizeTag(gateForm.enrollmentTag)}${
        gateForm.requireMention && gateForm.joinAccount ? ` and mention ${gateForm.joinAccount}` : ""
      }.`
    : "Add an enrollment tag to generate join instructions.";

  const gateSubmitPreview = gateForm?.submissionTag
    ? `To submit a single post, include #${normalizeTag(gateForm.submissionTag)} in the post text.`
    : "Add a submission tag to enable single-post submissions.";

  const moderatedEnabled = gates.some((gate) => gate.gate_type === "hashtag_opt_in" && gate.mode === "moderated");
  const pendingRequests = joinRequests.filter((req) => req.status === "pending");

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
            <div className="mt-1">Choose accounts and add gates.</div>
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
          <div className="mt-2 text-sm text-black/60">Choose a feed above to configure sources, gates, rules, and publishing.</div>
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
              ["gating", "Gating"],
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
              <div className="mt-2 text-xs text-black/50">Curate which accounts this feed watches.</div>

              <div className="mt-4 grid gap-4">
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

          {activeTab === "gating" && (
            <div className="space-y-6">
              <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Gating methods</div>
                    <div className="text-xs text-black/50">Add join and submission gates for this feed.</div>
                  </div>
                  <Button size="sm" onClick={() => setGateForm(defaultGateForm("hashtag_opt_in"))}>
                    Add gate
                  </Button>
                </div>

                {loadingGates ? (
                  <div className="mt-4 text-xs text-black/50">Loading gates...</div>
                ) : gates.length === 0 ? (
                  <div className="mt-4 text-xs text-black/50">No gates yet. Add a gate to enable joins or submissions.</div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {gates.map((gate) => (
                      <div key={gate.id} className="rounded-xl border border-black/10 bg-white/70 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-ink">{gate.gate_type.replace(/_/g, " ")}</div>
                            <div className="text-xs text-black/50">
                              {gate.mode ?? "public"} · {gate.is_enabled ? "Enabled" : "Disabled"}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                const config = gate.config ?? {};
                                if (gate.gate_type === "hashtag_opt_in") {
                                  setGateForm({
                                    id: gate.id,
                                    gateType: "hashtag_opt_in",
                                    mode: (gate.mode ?? "public") as "public" | "moderated",
                                    isEnabled: gate.is_enabled,
                                    enrollmentTag: config.enrollment_tag ?? "",
                                    submissionTag: config.submission_tag ?? "",
                                    requireMention: Boolean(config.require_mention),
                                    joinAccount: config.join_account ?? "",
                                    tokenChain: "base",
                                    tokenAddress: "",
                                    minBalance: "1",
                                    gateAction: "join"
                                  });
                                } else {
                                  setGateForm({
                                    id: gate.id,
                                    gateType: "token_gate",
                                    mode: "public",
                                    isEnabled: gate.is_enabled,
                                    enrollmentTag: "",
                                    submissionTag: "",
                                    requireMention: false,
                                    joinAccount: "",
                                    tokenChain: config.chain ?? "base",
                                    tokenAddress: config.token ?? "",
                                    minBalance: String(config.min_balance ?? "1"),
                                    gateAction: config.action ?? "join"
                                  });
                                }
                              }}
                            >
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteGate(gate.id)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {gateForm && (
                <Card>
                  <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Configure gate</div>
                  <div className="mt-4 grid gap-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Gate type</label>
                      <Select
                        value={gateForm.gateType}
                        onChange={(e) => setGateForm({ ...gateForm, gateType: e.target.value as GateFormState["gateType"] })}
                        className="min-h-[44px]"
                      >
                        <option value="hashtag_opt_in">Hashtag opt-in</option>
                        <option value="token_gate">Token gate</option>
                      </Select>
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs text-black/60">
                      <input
                        type="checkbox"
                        checked={gateForm.isEnabled}
                        onChange={(e) => setGateForm({ ...gateForm, isEnabled: e.target.checked })}
                        className="h-4 w-4"
                      />
                      Gate enabled
                    </label>

                    {gateForm.gateType === "hashtag_opt_in" ? (
                      <div className="grid gap-3">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Mode</label>
                          <Select
                            value={gateForm.mode}
                            onChange={(e) =>
                              setGateForm({ ...gateForm, mode: e.target.value as GateFormState["mode"] })
                            }
                            className="min-h-[44px]"
                          >
                            <option value="public">Public (auto-approve)</option>
                            <option value="moderated">Moderated (requires approval)</option>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Enrollment tag</label>
                          <Input
                            placeholder="AddToX"
                            value={gateForm.enrollmentTag}
                            onChange={(e) => setGateForm({ ...gateForm, enrollmentTag: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Submission tag (optional)</label>
                          <Input
                            placeholder="SubmitX"
                            value={gateForm.submissionTag}
                            onChange={(e) => setGateForm({ ...gateForm, submissionTag: e.target.value })}
                          />
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-black/60">
                          <input
                            type="checkbox"
                            checked={gateForm.requireMention}
                            onChange={(e) => setGateForm({ ...gateForm, requireMention: e.target.checked })}
                            className="h-4 w-4"
                          />
                          Require mention of BA6 join account
                        </label>
                        {gateForm.requireMention && (
                          <Input
                            placeholder="@join-account.bsky.social or did:plc..."
                            value={gateForm.joinAccount}
                            onChange={(e) => setGateForm({ ...gateForm, joinAccount: e.target.value })}
                          />
                        )}
                        <div className="rounded-lg border border-black/10 bg-white/80 p-3 text-xs text-black/60">
                          {gateJoinPreview}
                        </div>
                        <div className="rounded-lg border border-black/10 bg-white/80 p-3 text-xs text-black/60">
                          {gateSubmitPreview}
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Chain</label>
                          <Select
                            value={gateForm.tokenChain}
                            onChange={(e) =>
                              setGateForm({ ...gateForm, tokenChain: e.target.value as GateFormState["tokenChain"] })
                            }
                            className="min-h-[44px]"
                          >
                            <option value="base">Base</option>
                            <option value="solana">Solana</option>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Token contract / mint</label>
                          <Input
                            placeholder="0x... or So111..."
                            value={gateForm.tokenAddress}
                            onChange={(e) => setGateForm({ ...gateForm, tokenAddress: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Minimum balance</label>
                          <Input
                            placeholder="1"
                            value={gateForm.minBalance}
                            onChange={(e) => setGateForm({ ...gateForm, minBalance: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Gate action</label>
                          <Select
                            value={gateForm.gateAction}
                            onChange={(e) =>
                              setGateForm({ ...gateForm, gateAction: e.target.value as GateFormState["gateAction"] })
                            }
                            className="min-h-[44px]"
                          >
                            <option value="join">Join</option>
                            <option value="submit">Submit</option>
                            <option value="premium_features">Premium features</option>
                          </Select>
                        </div>
                        <div className="rounded-lg border border-black/10 bg-white/80 p-3 text-xs text-black/60">
                          Token gates control BA6 actions (joining/submit), not viewing in Bluesky.
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button size="sm" onClick={saveGate} disabled={savingGate} className="w-full sm:w-auto">
                        {savingGate ? "Saving..." : "Save gate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setGateForm(null)}
                        className="w-full sm:w-auto"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {moderatedEnabled && (
                <Card>
                  <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Join requests</div>
                  {pendingRequests.length === 0 ? (
                    <div className="mt-2 text-xs text-black/50">No pending requests.</div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {pendingRequests.map((req) => (
                        <div key={req.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 bg-white/70 px-3 py-2">
                          <div className="text-xs text-black/70 break-all">{req.requester_did}</div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => approveRequest(req.id)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => rejectRequest(req.id)}>
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
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
                    <li>Make sure sources or gates are configured.</li>
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
