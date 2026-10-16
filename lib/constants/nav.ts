import { BellIcon, FolderIcon, HouseIcon, InboxIcon, MessageCircleIcon, SettingsIcon, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** The main sections, shared by the desktop sidebar and the phone tab bar. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: HouseIcon },
  { href: "/reminders", label: "Reminders", icon: BellIcon },
  { href: "/chat", label: "Chat", icon: MessageCircleIcon },
  { href: "/inbox", label: "Inbox", icon: InboxIcon },
  { href: "/projects", label: "Projects", icon: FolderIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
