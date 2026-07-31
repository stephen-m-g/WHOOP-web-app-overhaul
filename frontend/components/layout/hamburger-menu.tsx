"use client";

import Link from "next/link";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Menu } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";

export function HamburgerMenu() {
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger
        className="flex size-9 cursor-pointer items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" aria-hidden="true" />
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <MenuPrimitive.Popup className="min-w-48 origin-[var(--transform-origin)] rounded-lg bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <MenuPrimitive.LinkItem
                  key={item.href}
                  render={<Link href={item.href} />}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-foreground outline-none data-[highlighted]:bg-muted"
                >
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  {item.label}
                </MenuPrimitive.LinkItem>
              );
            })}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
