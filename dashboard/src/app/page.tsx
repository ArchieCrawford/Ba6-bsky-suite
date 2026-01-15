"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { LoadingState } from "@/components/ui/States";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const route = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session) {
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      }
    };
    route();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingState label="Redirecting" />
    </div>
  );
}
