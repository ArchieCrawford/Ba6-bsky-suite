"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Ba6Mascot from "../../../../assets/Ba6.png";
import { ensureUserProfile } from "@/lib/ensureUserProfile";
import { ensureProfile } from "@/lib/ensureProfile";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { loginWithEmail, connectEthereum, connectSolana, storePendingWallets } from "@/lib/magic";
import { linkPendingWallets } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { session } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const profile = await ensureUserProfile();
      if (!profile.ok) {
        toast.error(profile.error ?? "Profile missing. Please retry from the dashboard.");
      } else {
        toast.success("Signed in");
      }
      const profileRow = await ensureProfile();
      if (!profileRow.ok) {
        toast.error(profileRow.error ?? "Unable to sync profile data.");
      }
      router.replace("/dashboard");
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  const signInWithWeb3 = async (chain: "solana" | "ethereum") => {
    if (chain === "solana") {
      const solana = (window as any)?.solana;
      if (!solana || !solana.isPhantom) {
        toast.error("Install Phantom to sign in with Solana.");
        return;
      }
    }
    if (chain === "ethereum") {
      const ethereum = (window as any)?.ethereum;
      if (!ethereum || !ethereum.isMetaMask) {
        toast.error("Install MetaMask to sign in with Ethereum.");
        return;
      }
    }

    setLoading(true);
    try {
      const { error } = await (supabase.auth as any).signInWithWeb3({
        chain,
        statement: "I accept the Terms of Service at https://ba6-bsky-suite.com/tos"
      });
      if (error) throw error;

      const profile = await ensureUserProfile();
      if (!profile.ok) {
        toast.error(profile.error ?? "Profile missing. Please retry from the dashboard.");
      }
      const profileRow = await ensureProfile();
      if (!profileRow.ok) {
        toast.error(profileRow.error ?? "Unable to sync profile data.");
      } else {
        toast.success("Signed in");
      }
      router.replace("/dashboard");
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to sign in with wallet");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicWallet = async (chain: "ethereum" | "solana", useEmailInput: boolean) => {
    const emailValue = (useEmailInput ? email : "") || window.prompt("Enter your email for Magic") || "";
    if (!emailValue.trim()) {
      toast.error("Email is required for Magic login");
      return;
    }
    setLoading(true);
    try {
      const wallet =
        chain === "solana" ? await connectSolana(emailValue.trim()) : await connectEthereum(emailValue.trim());
      storePendingWallets([wallet]);

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const linked = await linkPendingWallets();
        if (!linked.ok) {
          toast.error(linked.error ?? "Unable to link wallet");
        } else {
          toast.success("Wallet linked");
          router.replace("/dashboard");
        }
      } else {
        toast.success("Wallet connected. Sign in to link it.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Magic wallet connect failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLogin = async () => {
    if (!email.trim()) {
      toast.error("Enter your email to continue with Magic.");
      return;
    }
    setLoading(true);
    try {
      const result = await loginWithEmail(email.trim());
      if (result.wallets.length === 0) {
        toast.error("No wallet address returned from Magic.");
        return;
      }
      storePendingWallets(result.wallets);

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const linked = await linkPendingWallets();
        if (!linked.ok) {
          toast.error(linked.error ?? "Unable to link wallet");
        } else {
          toast.success("Wallet linked");
          router.replace("/dashboard");
        }
      } else {
        toast.success("Wallet connected. Sign in to link it.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Magic login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-5xl overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative min-h-[320px] w-full sm:min-h-[420px] lg:min-h-[520px]">
          <Image
            src={Ba6Mascot}
            alt="BA6 mascot"
            fill
            priority
            className="object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute bottom-6 left-6">
            <div className="text-xs uppercase tracking-[0.3em] text-white/70">BA6</div>
            <div className="mt-2 text-2xl font-semibold text-white">Bluesky Ops Console</div>
            <div className="mt-2 text-sm text-white/80">Signed access for your multi-user workspace.</div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.3em] text-black/40">BA6</div>
          <h1 className="mt-2 text-2xl font-semibold">Sign in to the control panel</h1>
          <p className="mt-2 text-sm text-black/60">Use your email login.</p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 space-y-3">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={loading}
              onClick={() => signInWithWeb3("solana")}
            >
              Sign in with Solana (Phantom)
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={loading}
              onClick={() => signInWithWeb3("ethereum")}
            >
              Sign in with Ethereum (MetaMask)
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={loading}
              onClick={handleMagicLogin}
            >
              Continue with Magic (Email)
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={loading}
              onClick={() => handleMagicWallet("ethereum", false)}
            >
              Connect Wallet (Magic)
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
