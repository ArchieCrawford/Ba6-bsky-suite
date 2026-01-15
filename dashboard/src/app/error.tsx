"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/States";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="p-6">
      <ErrorState title="Something went wrong" subtitle={error.message} onRetry={reset} />
    </div>
  );
}
