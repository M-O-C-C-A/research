"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Loader2, ScanSearch } from "lucide-react";

interface FindDrugsButtonProps {
  companyId: string;
  size?: "sm" | "default";
}

export function FindDrugsButton({ companyId, size = "sm" }: FindDrugsButtonProps) {
  const findDrugs = useAction(api.discovery.findDrugsForCompany);
  const [loading, setLoading] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    try {
      const jobId = await findDrugs({
        companyId: companyId as Id<"companies">,
      });
      setLastJobId(jobId);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button size={size} variant="outline" onClick={handleClick} disabled={loading}
        className="border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600">
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <ScanSearch className="h-4 w-4 mr-2" />
        )}
        {loading ? "Scanning..." : "Find Drugs"}
      </Button>
      {lastJobId && (
        <a
          href={`/discovery?job=${lastJobId}`}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          View latest discovery job
        </a>
      )}
    </div>
  );
}
