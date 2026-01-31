import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui";

export default function HomePage() {
  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="ba6-card p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-ba6-muted text-sm">Local module preview</p>
              <h1 className="text-3xl font-semibold tracking-tight">
                BA6 • Clanker Token Launcher
              </h1>
            </div>
            <div className="hidden sm:block">
              <span className="inline-flex items-center rounded-full border border-ba6-border bg-black/30 px-3 py-1 text-xs text-ba6-muted">
                v0.1 • UI-first
              </span>
            </div>
          </div>

          <p className="mt-5 max-w-2xl text-ba6-muted">
            This repo is a self-contained, BA6-styled launcher flow you can run locally.
            The API endpoints are mocked by default (safe), but the wiring matches how
            we’ll embed it into BA6 later.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/clanker/launch">
              <Button>
                Open launcher <ArrowRight size={16} />
              </Button>
            </Link>
            <span className="text-sm text-ba6-muted">
              Local-first • no keys required
            </span>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-ba6-border bg-black/20 p-4">
              <p className="text-xs text-ba6-muted">Fee model</p>
              <p className="mt-1 text-sm">Off-chain creation fees</p>
            </div>
            <div className="rounded-xl border border-ba6-border bg-black/20 p-4">
              <p className="text-xs text-ba6-muted">Token legitimacy</p>
              <p className="mt-1 text-sm">Native Clanker factory deploys</p>
            </div>
            <div className="rounded-xl border border-ba6-border bg-black/20 p-4">
              <p className="text-xs text-ba6-muted">Safety</p>
              <p className="mt-1 text-sm">No custom Solidity in this repo</p>
            </div>
          </div>
        </div>

        <div className="ba6-card2 p-8">
          <div className="flex items-center gap-4">
            <Image
              src="/assets/ba6-bot.png"
              alt="BA6 humanoid"
              width={96}
              height={96}
              className="rounded-2xl border border-ba6-border bg-black/30"
              priority
            />
            <div>
              <p className="text-ba6-muted text-sm">BA6 vibe</p>
              <p className="text-lg font-medium">Minimal • dark • sharp</p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-ba6-muted">
            <p>
              This UI is meant to feel like a BA6 module card: dense info, clean edges,
              quiet glow.
            </p>
            <p>
              Next step after local preview: wire the launch endpoint to BA6 auth + billing.
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
