import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BA6 • Clanker Launcher (Local)",
  description: "Local preview UI for a BA6-style Clanker token launcher module."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
