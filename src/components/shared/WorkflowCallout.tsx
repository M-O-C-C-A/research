import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface WorkflowCalloutProps {
  eyebrow?: string;
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
  tone?: "default" | "emphasis";
}

export function WorkflowCallout({
  eyebrow,
  title,
  description,
  href,
  actionLabel,
  tone = "default",
}: WorkflowCalloutProps) {
  const toneClass =
    tone === "emphasis"
      ? "border-cyan-500/30 bg-cyan-500/5"
      : "border-zinc-800 bg-zinc-900";

  return (
    <div className={`rounded-xl border p-5 ${toneClass}`}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
        {description}
      </p>
      {href && actionLabel ? (
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-300 hover:text-cyan-200"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
