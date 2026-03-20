"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <div className="h-8 w-8 rounded bg-gradient-to-br from-white to-zinc-500 shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
              <span className="text-lg font-bold tracking-tight text-white uppercase">M-O-C-C-A</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {["Dashboard", "Research", "Datasets", "API"].map((item) => (
                <Link
                  key={item}
                  href="#"
                  className="text-sm font-medium text-zinc-400 transition-colors hover:text-white"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-zinc-400 hover:text-white">
              Sign In
            </Button>
            <Button size="sm" className="rounded-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200">
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
