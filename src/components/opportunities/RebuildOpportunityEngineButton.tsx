"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

export function RebuildOpportunityEngineButton() {
  const rebuild = useAction(api.decisionOpportunities.rebuildFromResearch);
  const [isRunning, setIsRunning] = useState(false);

  async function handleClick() {
    setIsRunning(true);
    try {
      await rebuild({});
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isRunning}
      variant="outline"
      className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
    >
      {isRunning ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" />
      )}
      Rebuild Engine
    </Button>
  );
}
