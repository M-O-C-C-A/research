"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { ReactNode, useEffect, useRef, useState } from "react";
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

function OpenAccessSession() {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string>();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void signIn("anonymous").catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Could not open the workspace");
    });
  }, [signIn]);

  if (error) return <div className="grid min-h-screen place-items-center bg-zinc-950 p-6 text-red-200">{error}</div>;
  return <div className="grid min-h-screen place-items-center bg-zinc-950 text-sm text-zinc-400">Opening KEMEDICA…</div>;
}

export function AuthenticationGate({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading><div className="grid min-h-screen place-items-center bg-zinc-950 text-sm text-zinc-400">Checking access…</div></AuthLoading>
      <Unauthenticated><OpenAccessSession /></Unauthenticated>
      <Authenticated><WorkspaceBootstrap>{children}</WorkspaceBootstrap></Authenticated>
    </>
  );
}
