import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Topbar />
          <main className="flex-1 space-y-6 px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 sm:pb-6">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
