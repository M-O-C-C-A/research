"use client";

import { ReactNode, useMemo } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(() => {
    if (!convexUrl) {
      return null;
    }

    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  if (!client) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-3xl px-6 py-24">
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6">
            <h1 className="text-lg font-semibold text-white">
              Configuration Error
            </h1>
            <p className="mt-2 text-sm text-red-100/80">
              Missing <code>NEXT_PUBLIC_CONVEX_URL</code>. The app deployed, but
              Convex is not configured for this environment.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
