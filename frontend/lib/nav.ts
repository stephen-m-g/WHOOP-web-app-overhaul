import type { LucideIcon } from "lucide-react";
import { LayoutGrid, Moon, BatteryCharging, User, Video } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/sleep", label: "Sleep", icon: Moon },
  { href: "/recovery", label: "Recovery", icon: BatteryCharging },
  { href: "/strain", label: "Strain", icon: User },
  { href: "/jump-trainer", label: "Jump Trainer", icon: Video },
];
