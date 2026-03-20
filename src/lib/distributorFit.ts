export const PIPELINE_STAGES = [
  { key: "screened", label: "Screened", color: "bg-zinc-500", badge: "bg-zinc-700 text-zinc-300" },
  { key: "qualified", label: "Qualified", color: "bg-cyan-500", badge: "bg-cyan-500/20 text-cyan-300" },
  { key: "contacted", label: "Contacted", color: "bg-blue-500", badge: "bg-blue-500/20 text-blue-300" },
  { key: "intro_call", label: "Intro Call", color: "bg-indigo-500", badge: "bg-indigo-500/20 text-indigo-300" },
  { key: "data_shared", label: "Data Shared", color: "bg-violet-500", badge: "bg-violet-500/20 text-violet-300" },
  { key: "partner_discussion", label: "Partner Discussion", color: "bg-fuchsia-500", badge: "bg-fuchsia-500/20 text-fuchsia-300" },
  { key: "negotiating", label: "Negotiating", color: "bg-orange-500", badge: "bg-orange-500/20 text-orange-300" },
  { key: "won", label: "Won", color: "bg-emerald-500", badge: "bg-emerald-500/20 text-emerald-300" },
  { key: "lost", label: "Lost", color: "bg-red-500", badge: "bg-red-500/10 text-red-400" },
] as const;

export const PIPELINE_STAGE_LABELS = Object.fromEntries(
  PIPELINE_STAGES.map((stage) => [stage.key, stage.label])
) as Record<string, string>;

export const PIPELINE_STAGE_BADGES = Object.fromEntries(
  PIPELINE_STAGES.map((stage) => [stage.key, stage.badge])
) as Record<string, string>;

export function normalizePipelineStage(status?: string | null) {
  switch (status) {
    case "qualified":
    case "contacted":
    case "intro_call":
    case "data_shared":
    case "partner_discussion":
    case "negotiating":
    case "won":
    case "lost":
    case "screened":
      return status;
    case "prospect":
      return "screened";
    case "engaged":
      return "partner_discussion";
    case "contracted":
      return "won";
    case "disqualified":
      return "lost";
    default:
      return "screened";
  }
}

export function priorityTierLabel(priorityTier?: string | null) {
  switch (priorityTier) {
    case "tier_1":
      return "Tier 1";
    case "tier_2":
      return "Tier 2";
    case "tier_3":
      return "Tier 3";
    case "deprioritized":
      return "Deprioritized";
    default:
      return null;
  }
}
