import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "BA6 Control Panel",
  description: "Supabase-backed Bluesky scheduling and feed operations"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${space.variable} ${plex.variable}`}>
      <body className="font-[var(--font-body)]">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
