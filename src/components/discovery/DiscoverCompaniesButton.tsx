"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Loader2, Radar } from "lucide-react";
import { useRouter } from "next/navigation";

interface DiscoverCompaniesButtonProps {
  size?: "sm" | "default";
  variant?: "default" | "outline";
  onJobStarted?: (jobId: string) => void;
}

export function DiscoverCompaniesButton({
  size = "default",
  variant = "default",
  onJobStarted,
}: DiscoverCompaniesButtonProps) {
  const findCompanies = useAction(api.discovery.findCompanies);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    try {
      const jobId = await findCompanies({});
      onJobStarted?.(jobId);
      router.push(`/discovery?job=${jobId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size={size} variant={variant} onClick={handleClick} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Radar className="h-4 w-4 mr-2" />
      )}
      {loading ? "Scanning..." : "Discover Companies"}
    </Button>
  );
}
