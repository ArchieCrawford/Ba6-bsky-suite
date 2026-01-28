"use client";

import { useEffect, useState } from "react";

type CheckStatus = "checking" | "ok" | "down" | "missing";

type CheckItem = {
  label: string;
  provider: "Render" | "Vercel";
  url: string;
  status: CheckStatus;
  latency?: number;
  error?: string;
};

const DEFAULT_RENDER_URL =
  process.env.NEXT_PUBLIC_RENDER_HEALTH_URL ?? "https://ba6-bsky-feedgen.onrender.com/healthz";
const DEFAULT_VERCEL_URL = process.env.NEXT_PUBLIC_VERCEL_HEALTH_URL ?? "/api/healthz";

const badgeStyles: Record<CheckStatus, string> = {
  checking: "border-black/10 bg-black/5 text-black/60",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  down: "border-rose-200 bg-rose-50 text-rose-700",
  missing: "border-amber-200 bg-amber-50 text-amber-700"
};

export default function StatusChecks({
  renderUrl = DEFAULT_RENDER_URL,
  vercelUrl = DEFAULT_VERCEL_URL
}: {
  renderUrl?: string;
  vercelUrl?: string;
}) {
  const [checks, setChecks] = useState<CheckItem[]>([
    {
      label: "Feedgen API",
      provider: "Render",
      url: renderUrl,
      status: renderUrl ? "checking" : "missing"
    },
    {
      label: "Docs Site",
      provider: "Vercel",
      url: vercelUrl,
      status: vercelUrl ? "checking" : "missing"
    }
  ]);

  useEffect(() => {
    let isActive = true;

    const runCheck = async (item: CheckItem) => {
      if (!item.url) return item;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const start = performance.now();

      try {
        const res = await fetch(item.url, { cache: "no-store", signal: controller.signal });
        const latency = Math.round(performance.now() - start);
        clearTimeout(timeout);
        return {
          ...item,
          status: res.ok ? "ok" : "down",
          latency,
          error: res.ok ? undefined : `HTTP ${res.status}`
        };
      } catch (err: any) {
        clearTimeout(timeout);
        return {
          ...item,
          status: "down",
          error: err?.message ?? "Request failed"
        };
      }
    };

    const run = async () => {
      const results = await Promise.all(checks.map((item) => runCheck(item)));
      if (isActive) setChecks(results);
    };

    run();
    const interval = setInterval(run, 60000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [renderUrl, vercelUrl]);

  return (
    <div className="grid gap-3">
      {checks.map((check) => (
        <div
          key={`${check.provider}-${check.label}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white/80 px-4 py-3"
        >
          <div>
            <div className="text-xs uppercase tracking-wide text-black/40">{check.provider}</div>
            <div className="text-sm font-semibold text-black/80">{check.label}</div>
            <div className="text-xs text-black/50 break-all">{check.url || "Set a health URL"}</div>
          </div>
          <div className="flex items-center gap-3">
            {check.latency !== undefined && (
              <span className="text-xs text-black/50">{check.latency}ms</span>
            )}
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                badgeStyles[check.status]
              }`}
            >
              {check.status === "checking" && "Checking"}
              {check.status === "ok" && "Healthy"}
              {check.status === "down" && "Degraded"}
              {check.status === "missing" && "Not configured"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
