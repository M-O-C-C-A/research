import { Skeleton } from "@/components/ui/skeleton";

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <Skeleton className="h-5 w-2/3 bg-zinc-800" />
          <Skeleton className="h-4 w-1/3 bg-zinc-800" />
          <Skeleton className="h-3 w-full bg-zinc-800" />
          <Skeleton className="h-3 w-4/5 bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full bg-zinc-800" />
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-2">
          <Skeleton className="h-4 w-1/2 bg-zinc-800" />
          <Skeleton className="h-8 w-16 bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}
