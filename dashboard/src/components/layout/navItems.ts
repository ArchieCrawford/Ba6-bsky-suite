import {
  LayoutGrid,
  CalendarClock,
  FileText,
  Rss,
  Users,
  Activity
} from "lucide-react";

export const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/scheduled", label: "Scheduled", icon: CalendarClock },
  { href: "/drafts", label: "Drafts", icon: FileText },
  { href: "/feeds", label: "Feeds", icon: Rss },
  { href: "/accounts", label: "Accounts", icon: Users },
  { href: "/events", label: "Events", icon: Activity }
];
