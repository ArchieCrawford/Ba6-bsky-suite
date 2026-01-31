"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy, Loader2, Sparkles } from "lucide-react";
import { Shell } from "@/components/clanker/Shell";
import { Badge, Button, CardTitle, Divider } from "@/components/clanker/ui";
import { LaunchRequestSchema, type LaunchRequest, type LaunchResponse, type QuoteResponse } from "@/lib/clanker/launchSchema";

type Step = "details" | "review" | "done";

const CHAINS = [
  { id: "base", label: "Base (recommended)" },
  { id: "mainnet", label: "Ethereum Mainnet" },
  { id: "testnet", label: "Testnet (local demo)" }
];

function shortAddr(a: string) {
  if (!a) return "";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

export default function LaunchPage() {
  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState<LaunchRequest>({
    chain: "base",
    name: "",
    symbol: "",
    imageUrl: "",
    devBuyUsd: 0,
    ownershipAddress: "",
    notes: ""
  });

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [launchLoading, setLaunchLoading] = useState(false);
  const [launchRes, setLaunchRes] = useState<LaunchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => LaunchRequestSchema.safeParse(form), [form]);
  const canQuote = parsed.success;

  async function getQuote() {
    setError(null);
    setQuote(null);
    setQuoteLoading(true);
    try {
      const r = await fetch("/api/clanker/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Quote failed");
      setQuote(j);
      setStep("review");
    } catch (e: any) {
      setError(e?.message || "Quote failed");
    } finally {
      setQuoteLoading(false);
    }
  }

  async function launch() {
    setError(null);
    setLaunchLoading(true);
    try {
      const r = await fetch("/api/clanker/launch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Launch failed");
      setLaunchRes(j);
      setStep("done");
    } catch (e: any) {
      setError(e?.message || "Launch failed");
    } finally {
      setLaunchLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-ba6-muted hover:text-ba6-text">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="flex items-center gap-2">
          <Badge>Clanker</Badge>
          <Badge>Creation fee</Badge>
          <Badge>Local preview</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="ba6-card p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Launch a token</CardTitle>
              <p className="mt-1 text-sm text-ba6-muted">
                This flow is UI-first. The backend is mocked (safe) until you wire BA6 auth + billing + real deploy.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-ba6-accent" />
              <span className="text-xs text-ba6-muted">
                {step === "details" ? "Step 1/3" : step === "review" ? "Step 2/3" : "Step 3/3"}
              </span>
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {step === "details" ? (
            <div className="mt-8 space-y-5">
              <div>
                <label className="ba6-label">Chain</label>
                <select
                  className="ba6-input mt-2"
                  value={form.chain}
                  onChange={(e) => setForm((s) => ({ ...s, chain: e.target.value }))}
                >
                  {CHAINS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="ba6-label">Token name</label>
                  <input
                    className="ba6-input mt-2"
                    placeholder="e.g., BA6 Builders"
                    value={form.name}
                    onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="ba6-label">Symbol (A–Z / 0–9)</label>
                  <input
                    className="ba6-input mt-2 uppercase"
                    placeholder="BA6"
                    value={form.symbol}
                    onChange={(e) => setForm((s) => ({ ...s, symbol: e.target.value.toUpperCase() }))}
                  />
                </div>
              </div>

              <div>
                <label className="ba6-label">Image URL (optional)</label>
                <input
                  className="ba6-input mt-2"
                  placeholder="https://…"
                  value={form.imageUrl ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, imageUrl: e.target.value }))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="ba6-label">Dev buy (USD)</label>
                  <input
                    className="ba6-input mt-2"
                    type="number"
                    min={0}
                    max={5000}
                    value={form.devBuyUsd}
                    onChange={(e) => setForm((s) => ({ ...s, devBuyUsd: Number(e.target.value) }))}
                  />
                  <p className="mt-2 text-xs text-ba6-muted">
                    For local preview this is just metadata; real deploy can use it to perform a dev-buy step.
                  </p>
                </div>

                <div>
                  <label className="ba6-label">Owner wallet address</label>
                  <input
                    className="ba6-input mt-2"
                    placeholder="0x…"
                    value={form.ownershipAddress}
                    onChange={(e) => setForm((s) => ({ ...s, ownershipAddress: e.target.value }))}
                  />
                  <p className="mt-2 text-xs text-ba6-muted">
                    BA6 should transfer ownership to this address immediately after deploy.
                  </p>
                </div>
              </div>

              <div>
                <label className="ba6-label">Notes (optional)</label>
                <textarea
                  className="ba6-input mt-2 min-h-[96px]"
                  placeholder="Internal notes for the BA6 record…"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>

              {!parsed.success ? (
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-xs text-yellow-200">
                  <div className="font-semibold">Fix these before quoting:</div>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {parsed.error.issues.slice(0, 5).map((i, idx) => (
                      <li key={idx}>
                        <span className="opacity-80">{i.path.join(".")}</span>: {i.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button onClick={getQuote} disabled={!canQuote || quoteLoading}>
                  {quoteLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  Get quote
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setForm({
                      chain: "base",
                      name: "BA6 Builders",
                      symbol: "BA6",
                      imageUrl: "",
                      devBuyUsd: 50,
                      ownershipAddress: "0x0000000000000000000000000000000000000000",
                      notes: "Sample payload (replace owner address)"
                    })
                  }
                >
                  Fill sample
                </Button>
              </div>
            </div>
          ) : null}

          {step === "review" ? (
            <div className="mt-8 space-y-6">
              <div className="rounded-xl border border-ba6-border bg-black/20 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">Quote</div>
                  <Badge>{form.chain}</Badge>
                </div>
                <Divider />
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border border-ba6-border bg-black/20 px-4 py-3">
                    <span className="text-ba6-muted">Creation fee</span>
                    <span>${quote?.creationFeeUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-ba6-border bg-black/20 px-4 py-3">
                    <span className="text-ba6-muted">Estimated gas</span>
                    <span>${quote?.estimatedGasUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-ba6-border bg-black/20 px-4 py-3 sm:col-span-2">
                    <span className="text-ba6-muted">Total</span>
                    <span className="text-base font-semibold">${quote?.totalUsd.toFixed(2)}</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-ba6-muted">{quote?.disclaimer}</p>
              </div>

              <div className="rounded-xl border border-ba6-border bg-black/20 p-5">
                <div className="text-sm font-medium">Launch details</div>
                <Divider />
                <div className="mt-4 grid gap-3 text-sm">
                  <Row label="Name" value={form.name} />
                  <Row label="Symbol" value={form.symbol} />
                  <Row label="Owner" value={form.ownershipAddress} />
                  <Row label="Dev buy" value={`$${form.devBuyUsd.toFixed(2)}`} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" onClick={() => setStep("details")} disabled={launchLoading}>
                  Edit
                </Button>
                <Button onClick={launch} disabled={launchLoading}>
                  {launchLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                  Launch (mock)
                </Button>
              </div>
            </div>
          ) : null}

          {step === "done" && launchRes ? (
            <div className="mt-8 space-y-6">
              <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-green-300" />
                  <div>
                    <div className="font-semibold">Token created (mock)</div>
                    <div className="text-sm text-ba6-muted">
                      This is a simulated launch result. Wire the route to real clanker-sdk deploy when ready.
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-ba6-border bg-black/20 p-5">
                <div className="text-sm font-medium">Receipt</div>
                <Divider />
                <div className="mt-4 grid gap-3 text-sm">
                  <Row
                    label="Token address"
                    value={launchRes.tokenAddress}
                    right={
                      <button
                        className="inline-flex items-center gap-1 text-xs text-ba6-muted hover:text-ba6-text"
                        onClick={() => copy(launchRes.tokenAddress)}
                      >
                        <Copy size={14} /> Copy
                      </button>
                    }
                  />
                  <Row label="Deploy tx" value={launchRes.deployTxHash} />
                  <Row label="Transfer tx" value={launchRes.transferTxHash} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a className="text-sm text-ba6-accent2 hover:underline" href={launchRes.receiptUrl} target="_blank" rel="noreferrer">
                    Open receipt
                  </a>
                  <Button variant="ghost" onClick={() => { setStep("details"); setQuote(null); setLaunchRes(null); }}>
                    Launch another
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="ba6-card p-6">
            <div className="text-sm font-medium">How we keep audits optional</div>
            <p className="mt-2 text-sm text-ba6-muted">
              We don’t deploy custom Solidity here. BA6 charges the creation fee off-chain, and uses official Clanker contracts to deploy.
              Ownership transfers to the user immediately. No lingering admin powers.
            </p>
          </div>

          <div className="ba6-card p-6">
            <div className="text-sm font-medium">What to wire later (BA6)</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ba6-muted">
              <li>Require BA6 auth + rate limits</li>
              <li>Collect creation fee (Stripe / wallet transfer)</li>
              <li>Run real clanker-sdk deploy + ownership transfer</li>
              <li>Write launch record to Supabase</li>
              <li>Render token “Space” or chat room from token address</li>
            </ul>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function Row({ label, value, right }: { label: string; value: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ba6-border bg-black/20 px-4 py-3">
      <div className="text-ba6-muted">{label}</div>
      <div className="flex items-center gap-3 font-mono text-xs sm:text-sm">
        <span className="break-all">{value}</span>
        {right}
      </div>
    </div>
  );
}
