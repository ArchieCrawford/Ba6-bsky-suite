import {
  LayoutGrid,
  CalendarClock,
  FileText,
  Sparkles,
  MessageSquare,
  Video,
  Rss,
  Users,
  Wallet,
  Activity,
  LifeBuoy
} from "lucide-react";

export const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/scheduled", label: "Scheduled", icon: CalendarClock },
  { href: "/drafts", label: "Drafts", icon: FileText },
  { href: "/generate/image", label: "Generate", icon: Sparkles },
  { href: "/generate/text", label: "Generate Text", icon: MessageSquare },
  { href: "/generate/video", label: "Generate Video", icon: Video },
  { href: "/feeds", label: "Feeds", icon: Rss },
  { href: "/accounts", label: "Accounts", icon: Users },
  { href: "/wallets", label: "Wallets", icon: Wallet },
  { href: "/events", label: "Events", icon: Activity },
  { href: "https://support.ba6-bsky-suite.com", label: "Support", icon: LifeBuoy, external: true }
];
