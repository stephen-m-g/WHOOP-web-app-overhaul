"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { HamburgerMenu } from "@/components/layout/hamburger-menu";
import { NAV_ITEMS } from "@/lib/nav";

export function Header() {
  const pathname = usePathname();
  const currentPage = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <header className="relative z-20 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/dashboard" aria-label="Go to dashboard">
          <Image src="/whoop-logo.png" alt="WHOOP" width={140} height={36} priority className="h-6 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          {currentPage && <span className="text-lg font-bold tracking-tight text-foreground">{currentPage.label}</span>}
          <HamburgerMenu />
        </div>
      </div>
    </header>
  );
}
