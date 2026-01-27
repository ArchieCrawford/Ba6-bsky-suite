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

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://ba6-bsky-suite.com");

const metaTitle = "BA6 Bluesky Ops Console";
const metaDescription =
  "Operate Bluesky scheduling, feeds, and automation from the BA6 control panel.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: metaTitle,
  description: metaDescription,
  openGraph: {
    title: metaTitle,
    description: metaDescription,
    type: "website",
    images: [
      {
        url: "/LinkCover.png",
        width: 1200,
        height: 630,
        alt: "BA6 Bluesky Ops Console"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: metaTitle,
    description: metaDescription,
    images: ["/LinkCover.png"]
  }
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
