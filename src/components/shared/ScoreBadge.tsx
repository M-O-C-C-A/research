import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score?: number | null;
  className?: string;
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  if (score === undefined || score === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-medium",
          "bg-zinc-800 text-zinc-500",
          className
        )}
      >
        —
      </span>
    );
  }

  const color =
    score >= 7
      ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
      : score >= 4
        ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
        : "bg-red-500/15 text-red-400 ring-1 ring-red-500/30";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold tabular-nums",
        color,
        className
      )}
    >
      {score}/10
    </span>
  );
}
