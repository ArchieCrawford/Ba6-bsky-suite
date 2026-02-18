import { ENV } from "./env";

export type ConsoleTool = {
  label: string;
  path: string;
  description?: string;
};

export const consoleTools: ConsoleTool[] = [
  { label: "Overview", path: "/dashboard", description: "Key metrics and system overview." },
  { label: "Events", path: "/events", description: "Audit trail and activity streams." },
  { label: "Generate Image", path: "/generate/image", description: "Create and refine imagery." },
  { label: "Generate Text", path: "/generate/text", description: "Draft or summarize content." },
  { label: "Generate Video", path: "/generate/video", description: "Build short clips and assets." },
  { label: "Feeds", path: "/feeds", description: "Manage curated feeds." },
  { label: "Accounts", path: "/accounts", description: "Identity and account controls." },
  { label: "Wallets", path: "/wallets", description: "Wallet connections and status." },
  { label: "Clanker Launcher", path: "/clanker", description: "Launch operational tooling." },
  { label: "Support", path: "https://support.ba6-bsky-suite.com", description: "Get help and support." }
];

export function getConsoleBase() {
  const raw = ENV.DASHBOARD_URL || ENV.BA6_API_BASE || "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export function buildConsoleUrl(path: string) {
  if (path.startsWith("http")) return path;
  const base = getConsoleBase();
  if (!base) return "";
  return `${base}${path}`;
}
