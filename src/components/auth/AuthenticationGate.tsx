"use client";

import { useMutation, useQuery } from "convex/react";
import { ReactNode, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";

function WorkspaceBootstrap({ children }: { children: ReactNode }) {
  const member = useQuery(api.workspaceMembers.current);
  const ensureCurrent = useMutation(api.workspaceMembers.ensureCurrent);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (member !== null) return;
    void ensureCurrent({}).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Could not join the workspace");
    });
  }, [ensureCurrent, member]);

  if (error) {
    return <div className="grid min-h-screen place-items-center bg-zinc-950 p-6 text-red-200">{error}</div>;
  }
  if (member === undefined || member === null) {
    return <div className="grid min-h-screen place-items-center bg-zinc-950 text-sm text-zinc-400">Preparing your KEMEDICA workspace…</div>;
  }
  return children;
}

export function AuthenticationGate({ children }: { children: ReactNode }) {
  return <WorkspaceBootstrap>{children}</WorkspaceBootstrap>;
}
