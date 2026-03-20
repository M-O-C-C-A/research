"use client";

import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";

export default function Home() {
  const messages = useQuery(api.myFunctions.listMessages);

  return (
    <div className="relative isolate min-h-screen bg-zinc-950 text-zinc-50 selection:bg-zinc-500/30">
      {/* Background Hero Image */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <Image
          src="/hero-bg.png"
          alt="Hero background"
          fill
          className="object-cover opacity-40 brightness-75 scale-105 transition-transform duration-1000"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/20 via-zinc-950/80 to-zinc-950" />
      </div>

      <main className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-8 flex items-center gap-x-4 rounded-full bg-zinc-900/50 px-4 py-1.5 text-sm font-medium ring-1 ring-zinc-800 backdrop-blur-sm transition-colors hover:bg-zinc-900/80">
            <span className="text-zinc-500">New:</span> Real-time Research Database
            <div className="h-4 w-px bg-zinc-800 mx-2" />
            <span className="text-zinc-400">Powered by Convex</span>
          </div>

          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl lg:text-8xl bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent pb-4">
            Accelerate Your <br /> Scientific Discovery
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400 sm:text-xl">
            A high-performance research platform built with Next.js, Convex, 
            and Shadcn UI. Designed for speed, collaboration, and precision.
          </p>

          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button size="lg" className="rounded-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              Get Started
            </Button>
            <Button variant="ghost" size="lg" className="rounded-full text-zinc-300 hover:text-white transition-all">
              View Documentation <span className="ml-2">→</span>
            </Button>
          </div>
        </div>

        {/* Convex Demo Section */}
        <div className="mt-32 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 backdrop-blur-md">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-medium tracking-tight text-white/90">
              Live Database Feed
            </h2>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Connected</span>
            </div>
          </div>

          <div className="space-y-4">
            {messages === undefined ? (
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-zinc-800/50" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 font-mono text-sm border border-dashed border-zinc-800 rounded-lg">
                No research entries found. Ready to sync.
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg._id} className="group flex flex-col gap-1 rounded-lg border border-zinc-800/50 bg-zinc-900/50 p-4 transition-all hover:bg-zinc-800/50">
                  <span className="text-xs font-medium text-zinc-500 group-hover:text-zinc-400 transition-colors uppercase tracking-tight">{msg.author}</span>
                  <p className="text-sm text-zinc-300 transition-colors group-hover:text-zinc-100">{msg.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
