"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="max-w-md rounded-xl border border-black/10 bg-white p-6 shadow-soft">
          <div className="text-xs uppercase tracking-[0.3em] text-black/40">System Error</div>
          <h1 className="mt-2 text-2xl font-semibold">Something broke</h1>
          <p className="mt-2 text-sm text-black/60">{error.message}</p>
          <Button className="mt-6" onClick={reset}>
            Try again
          </Button>
        </div>
      </body>
    </html>
  );
}
