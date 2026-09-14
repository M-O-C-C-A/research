"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import type { Doc } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import {
  RESEARCH_CHECKS,
  reviewBasis,
  researchReviewBlockers,
  commercialSignals,
} from "../../../convex/medicineDiscoveryReviewPolicy";
import { Button } from "@/components/ui/button";

type Props = {
  medicine: Doc<"medicineDiscoveries">;
  country: "UAE" | "Saudi Arabia" | "Egypt";
};
export function CommercialReviewPanel({ medicine: m, country }: Props) {
  const record = useMutation(api.medicineDiscovery.recordCommercialReview);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const blockers = researchReviewBlockers(m, country);
  const signals = commercialSignals(m, country);
  const basis = reviewBasis(m);
  const reviewed =
    blockers.length === 0 &&
    m.commercialReview?.basis === basis &&
    m.commercialReview.country === country;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await record({
        id: m._id,
        country,
        expectedBasis: basis,
        reviewer: String(form.get("reviewer")),
        registrationNote: String(form.get("registration")),
        rightsNote: String(form.get("rights")),
        rationale: String(form.get("rationale")),
        evidenceUrls: String(form.get("urls")).split(/\s+/).filter(Boolean),
        resolvedSignalUrls: [...new Set(form.getAll("resolved").map(String))],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 rounded-xl border border-zinc-700 p-4">
      <p className="font-semibold text-white">
        Commercial qualification · {country}
      </p>
      <p className="mt-2 text-sm text-zinc-300">
        {reviewed
          ? `Review recorded by ${m.commercialReview!.reviewer}. Eligible for this country's shortlist.`
          : "Research candidate — not commercially qualified."}
      </p>
      {m.commercialReview?.country === country && (
        <details className="mt-3 rounded-lg bg-zinc-950/50 p-3">
          <summary className="cursor-pointer text-sm text-sky-300">
            {reviewed
              ? "Recorded review"
              : "Previous review — revalidation required"}{" "}
            · {m.commercialReview.reviewer}
          </summary>
          <p className="mt-2 text-xs text-zinc-400">
            Recorded{" "}
            {new Date(m.commercialReview.reviewedAt).toLocaleDateString(
              "en-GB",
            )}
          </p>
          <dl className="mt-3 space-y-3 text-sm text-zinc-200">
            {[
              ["Registration", m.commercialReview.registrationNote],
              ["Representation and rights", m.commercialReview.rightsNote],
              ["Commercial rationale", m.commercialReview.rationale],
            ].map(([label, note]) => (
              <div key={label}>
                <dt className="font-semibold text-white">{label}</dt>
                <dd className="mt-1 whitespace-pre-wrap">{note}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 space-y-1">
            {m.commercialReview.evidenceUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-xs text-sky-300 underline"
              >
                {url}
              </a>
            ))}
          </div>
        </details>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-sky-300">
          Research checks (
          {m.researchChecks?.filter((c) => c.status === "completed").length ??
            0}
          /{RESEARCH_CHECKS.length})
        </summary>
        <p className="mt-2 text-xs text-zinc-400">
          Completed means the cited pages for that search were retrieved. It
          does not prove an exhaustive search, absent registration or available
          rights.
        </p>
        <ul className="mt-3 space-y-3 text-sm">
          {RESEARCH_CHECKS.map((check) => {
            const result = m.researchChecks?.find((c) => c.key === check.key);
            return (
              <li key={check.key}>
                <span className="text-zinc-100">{check.label}</span> ·{" "}
                <span
                  className={
                    result?.status === "completed"
                      ? "text-sky-300"
                      : "text-amber-200"
                  }
                >
                  {result?.status ?? "not checked"}
                </span>
                {result && (
                  <>
                    <p className="text-xs text-zinc-400">{result.detail}</p>
                    {result.sources.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="mr-3 block truncate text-xs text-sky-300 underline"
                      >
                        {url}
                      </a>
                    ))}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </details>
      {blockers.length > 0 ? (
        <p className="mt-3 text-sm text-amber-200">
          Before shortlisting: {blockers[0]}
        </p>
      ) : (
        <details className="mt-4" key={`${m._id}-${country}-${m.researchedAt}`}>
          <summary className="cursor-pointer text-sm font-semibold text-sky-300">
            {reviewed ? "Update commercial review" : "Record commercial review"}
          </summary>
          <form onSubmit={submit} className="mt-3 space-y-3">
            <p className="text-xs leading-5 text-zinc-400">
              Record the exact registration position, resolve partner scope and
              explain the commercial route. Search results alone cannot
              establish available rights. This shared workspace records the
              reviewer name you enter.
            </p>
            <label className="block text-sm text-zinc-200">
              Reviewing analyst
              <input
                name="reviewer"
                required
                minLength={2}
                maxLength={120}
                className="mt-1 block w-full rounded border border-zinc-600 bg-zinc-950 p-2"
              />
            </label>
            {[
              [
                "registration",
                "Registration: exact product/presentation, country, source and remaining limitations",
              ],
              [
                "rights",
                "Representation and rights: confirmed route and resolution of each warning",
              ],
              [
                "rationale",
                "Why this is actionable: target customer, unmet need and commercial route",
              ],
            ].map(([name, label]) => (
              <label key={name} className="block text-sm text-zinc-200">
                {label}
                <textarea
                  name={name}
                  required
                  minLength={40}
                  maxLength={4000}
                  rows={3}
                  className="mt-1 block w-full rounded border border-zinc-600 bg-zinc-950 p-2"
                />
              </label>
            ))}
            <label className="block text-sm text-zinc-200">
              Supporting evidence links (one per line)
              <textarea
                name="urls"
                required
                rows={2}
                className="mt-1 block w-full rounded border border-zinc-600 bg-zinc-950 p-2"
              />
            </label>
            {[...new Map(signals.map((s) => [s.url, s])).values()].map(
              (signal) => (
                <label
                  key={signal.url}
                  className="flex gap-2 text-sm text-amber-100"
                >
                  <input
                    type="checkbox"
                    name="resolved"
                    value={signal.url}
                    required
                  />
                  <span>
                    I have resolved this warning in the rights review:{" "}
                    {signal.claim}{" "}
                    <a
                      href={signal.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Source
                    </a>
                  </span>
                </label>
              ),
            )}
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving review…" : "Save commercial review"}
            </Button>
          </form>
        </details>
      )}
    </div>
  );
}
