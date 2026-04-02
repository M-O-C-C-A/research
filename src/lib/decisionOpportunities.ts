export function confidenceBadgeClass(level?: string | null) {
  switch (level) {
    case "high":
      return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
    case "medium":
      return "bg-amber-500/10 text-amber-300 border border-amber-500/20";
    case "low":
      return "bg-red-500/10 text-red-300 border border-red-500/20";
    default:
      return "bg-zinc-800 text-zinc-400 border border-zinc-700";
  }
}

export function statusBadgeClass(status?: string | null) {
  switch (status) {
    case "active":
      return "bg-[color:var(--brand-surface)] text-[var(--brand-300)] border border-[color:var(--brand-border)]";
    case "needs_validation":
      return "bg-amber-500/10 text-amber-300 border border-amber-500/20";
    case "archived":
      return "bg-zinc-800 text-zinc-400 border border-zinc-700";
    default:
      return "bg-zinc-800 text-zinc-400 border border-zinc-700";
  }
}

export function entryStrategyLabel(strategy?: string | null) {
  switch (strategy) {
    case "distributor":
      return "Distributor";
    case "licensing":
      return "Licensing";
    case "direct":
      return "Direct";
    case "watch":
      return "Watch";
    default:
      return "Unknown";
  }
}
