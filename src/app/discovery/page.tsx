"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { JobCard } from "@/components/discovery/JobCard";
import { DiscoverCompaniesButton } from "@/components/discovery/DiscoverCompaniesButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";
import { Radar } from "lucide-react";
import { Id } from "../../../convex/_generated/dataModel";

function DiscoveryPageInner() {
  const searchParams = useSearchParams();
  const highlightJobId = searchParams.get("job");

  const jobs = useQuery(api.discoveryJobs.list, { limit: 100 });

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <PageHeader
        title="Advanced"
        description="This area is for power users who want to inspect raw research runs, discovery logs, and sourcing activity behind the guided process and directories."
        action={<DiscoverCompaniesButton label="Research companies" />}
      />

      {jobs === undefined ? (
        <TableSkeleton rows={4} />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<Radar className="h-10 w-10" />}
          title="No discovery jobs yet"
          description="Run your first company scan to start populating your registry with European pharma companies."
          action={<DiscoverCompaniesButton />}
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard
              key={job._id}
              jobId={job._id as Id<"discoveryJobs">}
              defaultExpanded={job._id === highlightJobId}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default function DiscoveryPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
          <TableSkeleton rows={4} />
        </main>
      }
    >
      <DiscoveryPageInner />
    </Suspense>
  );
}
