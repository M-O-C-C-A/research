"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

const NAV_LINKS = [
  { label: "Dashboard", href: "/" },
  { label: "Gaps", href: "/gaps" },
  { label: "Pipeline", href: "/pipeline" },
  { label: "Manufacturers", href: "/companies" },
  { label: "Drugs", href: "/drugs" },
  { label: "Discovery", href: "/discovery" },
];

export function NavBar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4 md:gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <div className="h-8 w-8 rounded bg-gradient-to-br from-white to-zinc-500 shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
              <span className="text-base font-bold tracking-tight text-white uppercase sm:text-lg">
                {BRAND_NAME}
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      active
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 hidden sm:block">{BRAND_TAGLINE}</span>
            <button
              type="button"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-200 transition-colors hover:bg-zinc-800 md:hidden"
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "md:hidden overflow-hidden border-t border-zinc-800 bg-zinc-950/95 transition-[max-height,opacity] duration-200",
          mobileOpen ? "max-h-[24rem] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div id="mobile-navigation" className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <p className="mt-4 px-1 text-xs text-zinc-500 sm:hidden">{BRAND_TAGLINE}</p>
        </div>
      </div>
    </nav>
  );
}
