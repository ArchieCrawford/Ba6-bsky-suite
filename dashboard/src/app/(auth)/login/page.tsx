"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Ba6Mascot from "../../../../assets/Ba6.png";
import { ensureUserProfile } from "@/lib/ensureUserProfile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
      router.replace("/dashboard");
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to sign in");
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
        </div>
      </div>
    </Card>
  );
}
