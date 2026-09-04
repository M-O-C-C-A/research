"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowRight, Search, ShieldCheck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const COUNTRIES = ["Saudi Arabia", "UAE", "Egypt"] as const;
const STAGES = [
  "needs_evidence",
  "qualified",
  "contact_ready",
  "assigned",
  "contacted",
  "engaged",
  "diligence",
  "negotiating",
  "won",
] as const;
const REASONS = [
  "UNCLASSIFIED",
  "ALREADY_PARTNERED_ELSEWHERE",
  "OUT_LICENSING",
  "PARKED",
  "IGNORING",
  "STRUCTURAL_NO",
] as const;
type Country = (typeof COUNTRIES)[number];
type Stage = (typeof STAGES)[number];
type ReviewTarget = {
  opportunity: Record<string, unknown>;
  assessment: Record<string, unknown>;
  country: Country;
};

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function tone(value?: string) {
  if (
    [
      "PASS",
      "accepted",
      "contact_ready",
      "assigned",
      "contacted",
      "engaged",
      "won",
    ].includes(value ?? "")
  )
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
  if (["qualified", "high"].includes(value ?? ""))
    return "border-sky-500/40 bg-sky-500/10 text-sky-100";
  if (["FAIL", "rejected", "matches_found"].includes(value ?? ""))
    return "border-red-500/40 bg-red-500/10 text-red-100";
  return "border-amber-500/40 bg-amber-500/10 text-amber-100";
}
function Pill({
  children,
  value,
}: {
  children: React.ReactNode;
  value?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tone(value)}`}
    >
      {children}
    </span>
  );
}
function TextField({
  name,
  title,
  defaultValue = "",
  required = true,
  rows = 2,
}: {
  name: string;
  title: string;
  defaultValue?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label className="block text-xs font-medium text-zinc-300">
      {title}
      <textarea
        name={name}
        required={required}
        defaultValue={defaultValue}
        rows={rows}
        className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 p-2.5 text-sm text-white"
      />
    </label>
  );
}
function SelectField({
  name,
  title,
  defaultValue,
  options,
}: {
  name: string;
  title: string;
  defaultValue: string;
  options: readonly string[];
}) {
  return (
    <label className="block text-xs font-medium text-zinc-300">
      {title}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 p-2.5 text-sm text-white"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
function CheckField({
  name,
  title,
  checked = false,
}: {
  name: string;
  title: string;
  checked?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-zinc-200">
      <input
        name={name}
        type="checkbox"
        defaultChecked={checked}
        className="mt-1 accent-[var(--brand-500)]"
      />
      {title}
    </label>
  );
}
function NumberField({
  name,
  title,
  value = 0,
}: {
  name: string;
  title: string;
  value?: number;
}) {
  return (
    <label className="block text-xs font-medium text-zinc-300">
      {title}
      <input
        name={name}
        type="number"
        min={0}
        max={100}
        required
        defaultValue={value}
        className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 p-2.5 text-sm text-white"
      />
    </label>
  );
}

function AssessmentReview({
  target,
  onClose,
}: {
  target: ReviewTarget;
  onClose: () => void;
}) {
  const review = useMutation(api.evidenceFunnel.reviewAssessment);
  const addEvidence = useMutation(api.evidenceFunnel.addEvidence);
  const verifyContact = useMutation(api.evidenceFunnel.verifyContact);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const { opportunity, assessment } = target;
  const score = (key: string) =>
    Number(
      (assessment.scoreBreakdown as Record<string, unknown> | undefined)?.[
        key
      ] ?? 0,
    );
  const dateValue = (value: unknown, days = 0) =>
    new Date(Number(value ?? Date.now() + days * 86_400_000))
      .toISOString()
      .slice(0, 10);
  const gate = (key: string) =>
    String(
      (assessment.gateSnapshot as Record<string, unknown> | undefined)?.[key] ??
        "",
    );

  async function submit(form: FormData) {
    setSaving(true);
    setMessage(undefined);
    try {
      const assessmentId = await review({
        opportunityId: String(opportunity._id) as Id<"decisionOpportunities">,
        country: target.country,
        productIdentityConfirmed: form.get("productIdentityConfirmed") === "on",
        ownerConfirmed: form.get("ownerConfirmed") === "on",
        registrationStatus: String(
          assessment.registrationStatus ?? "unverified",
        ) as
          | "registered"
          | "under_registration"
          | "verified_absent"
          | "not_found_unverified"
          | "unverified",
        registrationEvidence: String(assessment.registrationEvidence ?? ""),
        rightsStatus: String(form.get("rightsStatus")) as
          | "clear_no_conflict_found"
          | "conflict"
          | "unknown"
          | "needs_review",
        presenceStatement: String(assessment.presenceStatement ?? ""),
        agentPartnerEvidence: String(form.get("agentPartnerEvidence") ?? ""),
        demandStrength: String(form.get("demandStrength")) as
          | "strong"
          | "medium"
          | "weak"
          | "none",
        strongSignalCount: Number(form.get("strongSignalCount") ?? 0),
        mediumSignalCount: Number(form.get("mediumSignalCount") ?? 0),
        demandSummary: String(form.get("demandSummary") ?? ""),
        competitionSummary: String(form.get("competitionSummary") ?? ""),
        economicsStatus: String(form.get("economicsStatus")) as
          | "evidence_backed"
          | "conservative_range"
          | "unvalidated",
        economicsSummary: String(form.get("economicsSummary") ?? ""),
        feasibilityReviewed: form.get("feasibilityReviewed") === "on",
        feasibilitySummary: String(form.get("feasibilitySummary") ?? ""),
        blockers: String(form.get("blockers") ?? "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        scoreBreakdown: {
          gapValidity: Number(form.get("gapValidity")),
          commercialValue: Number(form.get("commercialValue")),
          urgencyDemand: Number(form.get("urgencyDemand")),
          regulatoryFeasibility: Number(form.get("regulatoryFeasibility")),
          partnerRightsReachability: Number(
            form.get("partnerRightsReachability"),
          ),
          evidenceConfidence: Number(form.get("evidenceConfidence")),
        },
        criticalReviewOpen: form.get("criticalReviewOpen") === "on",
        evidenceObservedAt: new Date(
          String(form.get("evidenceObservedAt")),
        ).getTime(),
        staleAfter: new Date(String(form.get("staleAfter"))).getTime(),
        normalizedPresentationKey: String(
          opportunity.normalizedPresentationKey ??
            assessment.normalizedPresentationKey ??
            "",
        ),
        companyReasonCode: String(
          form.get("companyReasonCode"),
        ) as (typeof REASONS)[number],
        companyReasonEvidenceUrl: String(
          form.get("companyReasonEvidenceUrl") ?? "",
        ),
        companyReasonEvidenceExcerpt: String(
          form.get("companyReasonEvidenceExcerpt") ?? "",
        ),
        companyReasonObservedAt: new Date(
          String(form.get("companyReasonObservedAt")),
        ).getTime(),
        intendedLocalApplicant: String(
          form.get("intendedLocalApplicant") ?? "",
        ),
        nomineeCovenantStatus: String(form.get("nomineeCovenantStatus")) as
          | "not_requested"
          | "requested"
          | "reviewed"
          | "accepted"
          | "rejected",
        referenceApproved: form.get("referenceApproved") === "on",
        eligibleCategory: form.get("eligibleCategory") === "on",
        referencePriceAvailable: form.get("referencePriceAvailable") === "on",
        priceChainPasses: form.get("priceChainPasses") === "on",
        economicsCalculated: form.get("economicsCalculated") === "on",
        verificationMode:
          target.country === "UAE" ? "snapshot" : "targeted_check",
        targetedCheckResult:
          target.country === "UAE"
            ? undefined
            : (String(form.get("targetedCheckResult")) as
                | "matches_found"
                | "no_match_found"
                | "inconclusive"),
        targetedCheckSourceUrl:
          target.country === "UAE"
            ? undefined
            : String(form.get("targetedCheckSourceUrl") ?? ""),
        targetedCheckSearchTerms:
          target.country === "UAE"
            ? undefined
            : String(form.get("targetedCheckSearchTerms") ?? ""),
        targetedCheckEvidenceExcerpt:
          target.country === "UAE"
            ? undefined
            : String(form.get("targetedCheckEvidenceExcerpt") ?? ""),
      });
      const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
      if (sourceUrl)
        await addEvidence({
          opportunityId: String(opportunity._id) as Id<"decisionOpportunities">,
          assessmentId,
          title: String(form.get("sourceTitle") ?? "Reviewed evidence"),
          sourceUrl,
          sourceType: String(form.get("sourceType")),
          evidenceStrength: String(form.get("evidenceStrength")) as
            | "strong"
            | "medium"
            | "supporting",
          observedAt: Date.now(),
          parserVersion: "analyst-reviewed-v1.1",
          confidence: "confirmed",
          reviewState: "approved",
        });
      const contactName = String(form.get("contactName") ?? "").trim();
      if (contactName)
        await verifyContact({
          opportunityId: String(opportunity._id) as Id<"decisionOpportunities">,
          name: contactName,
          title: String(form.get("contactTitle") ?? ""),
          role: "business_development",
          email: String(form.get("contactEmail") ?? "").trim() || undefined,
          linkedinUrl:
            String(form.get("contactLinkedinUrl") ?? "").trim() || undefined,
          sourceUrl: String(form.get("contactSourceUrl") ?? ""),
          sourceKind: "company_website",
          verifiedAt: Date.now(),
        });
      setMessage(
        "Review saved. Registry matching and G1–G7 were recalculated from recorded evidence.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The review could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-title"
    >
      <form
        action={submit}
        className="mx-auto max-w-5xl rounded-2xl border border-zinc-600 bg-zinc-900 p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-300)]">
              Verify evidence
            </p>
            <h2
              id="review-title"
              className="mt-2 text-2xl font-semibold text-white"
            >
              {String(opportunity.productName)} · {target.country}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              {String(assessment.presenceStatement)}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <fieldset className="space-y-4 rounded-xl border border-zinc-700 p-4">
            <legend className="px-2 font-semibold text-white">
              G1–G4 · Product, gap and rights
            </legend>
            <CheckField
              name="referenceApproved"
              title="G1: Reference-market approval is sourced"
              checked={gate("g1ReferenceApproval") === "PASS"}
            />
            <CheckField
              name="eligibleCategory"
              title="G2: Marketed product is in scope"
              checked={gate("g2EligibleCategory") === "PASS"}
            />
            <CheckField
              name="productIdentityConfirmed"
              title="Exact product identity confirmed"
              checked={Boolean(assessment.productIdentityConfirmed)}
            />
            <CheckField
              name="ownerConfirmed"
              title="Manufacturer or MAH confirmed"
              checked={Boolean(assessment.ownerConfirmed)}
            />
            {target.country === "UAE" ? (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                UAE is verified automatically against the accepted EDE directory
                snapshot.
              </p>
            ) : (
              <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs leading-relaxed text-amber-100">
                  No complete public API is assumed. Record the exact official
                  registry check; a no-match is scoped to this search only.
                </p>
                <SelectField
                  name="targetedCheckResult"
                  title="Targeted registry result"
                  defaultValue={String(
                    assessment.targetedCheckResult ?? "inconclusive",
                  )}
                  options={["inconclusive", "no_match_found", "matches_found"]}
                />
                <TextField
                  name="targetedCheckSourceUrl"
                  title="Official registry URL"
                  defaultValue={String(assessment.targetedCheckSourceUrl ?? "")}
                  rows={1}
                />
                <TextField
                  name="targetedCheckSearchTerms"
                  title="Exact product, INN, form and strength searched"
                  defaultValue={String(
                    assessment.targetedCheckSearchTerms ?? "",
                  )}
                />
                <TextField
                  name="targetedCheckEvidenceExcerpt"
                  title="Observed result or screenshot reference"
                  defaultValue={String(
                    assessment.targetedCheckEvidenceExcerpt ?? "",
                  )}
                />
              </div>
            )}
            <SelectField
              name="companyReasonCode"
              title="Cited company-intent reason"
              defaultValue={String(
                assessment.companyReasonCode ?? "UNCLASSIFIED",
              )}
              options={REASONS}
            />
            <TextField
              name="companyReasonEvidenceUrl"
              title="Company-intent source URL"
              defaultValue={String(assessment.companyReasonEvidenceUrl ?? "")}
              required={false}
              rows={1}
            />
            <TextField
              name="companyReasonEvidenceExcerpt"
              title="Relevant excerpt"
              defaultValue={String(
                assessment.companyReasonEvidenceExcerpt ?? "",
              )}
              required={false}
            />
            <label className="block text-xs font-medium text-zinc-300">
              Company evidence observed
              <input
                name="companyReasonObservedAt"
                type="date"
                required
                defaultValue={dateValue(assessment.companyReasonObservedAt)}
                className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 p-2.5 text-white"
              />
            </label>
            <SelectField
              name="rightsStatus"
              title="Country rights status"
              defaultValue={String(assessment.rightsStatus)}
              options={[
                "needs_review",
                "unknown",
                "clear_no_conflict_found",
                "conflict",
              ]}
            />
            <TextField
              name="agentPartnerEvidence"
              title="Agent and rights evidence"
              defaultValue={String(assessment.agentPartnerEvidence)}
            />
          </fieldset>
          <fieldset className="space-y-4 rounded-xl border border-zinc-700 p-4">
            <legend className="px-2 font-semibold text-white">
              G5–G7 · Commercial case
            </legend>
            <CheckField
              name="referencePriceAvailable"
              title="G5: Cited reference price available"
              checked={gate("g5PriceChain") === "PASS"}
            />
            <CheckField
              name="priceChainPasses"
              title="Reviewed price chain passes"
              checked={gate("g5PriceChain") === "PASS"}
            />
            <CheckField
              name="economicsCalculated"
              title="G6: Source-backed scenario calculated"
              checked={String(assessment.economicsStatus) !== "unvalidated"}
            />
            <SelectField
              name="economicsStatus"
              title="Economics evidence quality"
              defaultValue={String(assessment.economicsStatus)}
              options={["unvalidated", "conservative_range", "evidence_backed"]}
            />
            <TextField
              name="economicsSummary"
              title="Economics and assumptions"
              defaultValue={String(assessment.economicsSummary)}
            />
            <SelectField
              name="demandStrength"
              title="G7: Demand strength"
              defaultValue={String(assessment.demandStrength)}
              options={["none", "weak", "medium", "strong"]}
            />
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                name="strongSignalCount"
                title="Strong sources"
                value={Number(assessment.strongSignalCount)}
              />
              <NumberField
                name="mediumSignalCount"
                title="Medium sources"
                value={Number(assessment.mediumSignalCount)}
              />
            </div>
            <TextField
              name="demandSummary"
              title="Demand evidence"
              defaultValue={String(assessment.demandSummary)}
            />
            <TextField
              name="competitionSummary"
              title="Competition evidence"
              defaultValue={String(assessment.competitionSummary)}
            />
          </fieldset>
          <fieldset className="space-y-4 rounded-xl border border-zinc-700 p-4">
            <legend className="px-2 font-semibold text-white">
              Operating structure
            </legend>
            <TextField
              name="intendedLocalApplicant"
              title="Intended local applicant (never default KEMEDICA)"
              defaultValue={String(assessment.intendedLocalApplicant ?? "")}
              required={false}
              rows={1}
            />
            <SelectField
              name="nomineeCovenantStatus"
              title="Nominee covenant"
              defaultValue={String(
                assessment.nomineeCovenantStatus ?? "not_requested",
              )}
              options={[
                "not_requested",
                "requested",
                "reviewed",
                "accepted",
                "rejected",
              ]}
            />
            <CheckField
              name="feasibilityReviewed"
              title="Route-to-market feasibility reviewed"
              checked={Boolean(assessment.feasibilityReviewed)}
            />
            <TextField
              name="feasibilitySummary"
              title="Feasibility conclusion"
              defaultValue={String(assessment.feasibilitySummary)}
            />
            <TextField
              name="blockers"
              title="Remaining blockers, one per line"
              defaultValue={
                Array.isArray(assessment.blockers)
                  ? assessment.blockers.join("\n")
                  : ""
              }
              required={false}
            />
            <CheckField
              name="criticalReviewOpen"
              title="A critical review item remains open"
              checked={Boolean(assessment.criticalReviewOpen)}
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-zinc-300">
                Observed
                <input
                  name="evidenceObservedAt"
                  type="date"
                  required
                  defaultValue={dateValue(assessment.evidenceObservedAt)}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 p-2.5 text-white"
                />
              </label>
              <label className="block text-xs text-zinc-300">
                Fresh until
                <input
                  name="staleAfter"
                  type="date"
                  required
                  defaultValue={dateValue(assessment.staleAfter, 90)}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 p-2.5 text-white"
                />
              </label>
            </div>
          </fieldset>
          <fieldset className="space-y-4 rounded-xl border border-zinc-700 p-4">
            <legend className="px-2 font-semibold text-white">
              Score and supporting proof
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {[
                "gapValidity",
                "commercialValue",
                "urgencyDemand",
                "regulatoryFeasibility",
                "partnerRightsReachability",
                "evidenceConfidence",
              ].map((key) => (
                <NumberField
                  key={key}
                  name={key}
                  title={label(key)}
                  value={score(key)}
                />
              ))}
            </div>
            <TextField
              name="sourceTitle"
              title="Supporting source title"
              required={false}
              rows={1}
            />
            <TextField
              name="sourceUrl"
              title="Supporting source URL"
              required={false}
              rows={1}
            />
            <SelectField
              name="sourceType"
              title="Source type"
              defaultValue="official_signal"
              options={[
                "official_signal",
                "official_registry",
                "authorized_export",
                "independent_market",
              ]}
            />
            <SelectField
              name="evidenceStrength"
              title="Evidence strength"
              defaultValue="strong"
              options={["strong", "medium", "supporting"]}
            />
            <p className="border-t border-zinc-700 pt-4 text-xs font-semibold uppercase text-zinc-400">
              Optional named contact
            </p>
            <TextField
              name="contactName"
              title="Full name"
              required={false}
              rows={1}
            />
            <TextField
              name="contactTitle"
              title="Current title"
              required={false}
              rows={1}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                name="contactEmail"
                title="Public work email"
                required={false}
                rows={1}
              />
              <TextField
                name="contactLinkedinUrl"
                title="Direct LinkedIn URL"
                required={false}
                rows={1}
              />
            </div>
            <TextField
              name="contactSourceUrl"
              title="Contact verification source"
              required={false}
              rows={1}
            />
          </fieldset>
        </div>
        {message ? (
          <p className="mt-5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            {message}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Recalculating…" : "Save review and recalculate gates"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function EvidenceFunnelDashboard({
  initialStage = "All",
}: {
  initialStage?: Stage | "All";
}) {
  const [stage, setStage] = useState<Stage | "All">(initialStage);
  const [country, setCountry] = useState<Country | "All">("All");
  const [queue, setQueue] = useState<"working" | "watchlist">("working");
  const [search, setSearch] = useState("");
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget>();
  const [feedback, setFeedback] = useState<string>();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const stats = useQuery(api.evidenceFunnel.stats);
  const coverage = useQuery(api.evidenceEngineV11.sourceCoverage);
  const rows = useQuery(api.evidenceFunnel.list, {
    stage: stage === "All" ? undefined : stage,
    targetCountry: country === "All" ? undefined : country,
    queue,
    search: search.trim() || undefined,
    limit: queue === "working" ? 20 : 100,
  });
  const members = useQuery(api.workspaceMembers.listAssignable);
  const approveCommercial = useMutation(
    api.evidenceFunnel.approveCommercialAssumptions,
  );
  const promote = useMutation(api.evidenceFunnel.promoteContactReady);
  const generate = useMutation(api.evidenceFunnel.generateOutreachPackage);
  const assign = useMutation(api.evidenceFunnel.assign);

  return (
    <section className="space-y-6">
      {reviewTarget ? (
        <AssessmentReview
          target={reviewTarget}
          onClose={() => setReviewTarget(undefined)}
        />
      ) : null}
      <header className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-300)]">
          KEMEDICA Evidence Engine v1.1
        </p>
        <div className="mt-2 flex flex-wrap justify-between gap-5">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold text-white">
              Screen the open slot. Then prove somebody wants it.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Every pursuit starts with a reference-market-approved presentation
              and the best available official country evidence. UAE uses a full
              snapshot; Saudi Arabia and Egypt use dated targeted checks until
              authorized exports become available. Shortages and tenders
              validate demand; they never create a lead.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-sky-200">
              Research assist: Tavily and OpenAI web search discover
              source-backed company, rights, demand and contact evidence. Their
              results always enter human review and never prove registry
              absence.
            </p>
          </div>
          <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3">
            <p className="text-xs font-semibold text-sky-100">
              Monthly planning target
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {stats?.contactReadyThisMonth ?? 0} / {stats?.monthlyTarget ?? 15}
            </p>
            <p className="text-xs text-sky-200">Never a hard cap</p>
          </div>
        </div>
        <ol className="mt-6 grid gap-2 sm:grid-cols-4">
          {[
            ["1", "Choose", "Reference-approved product"],
            ["2", "Verify", "Country evidence and G1–G7"],
            ["3", "Approve", "Human commercial decision"],
            ["4", "Contact", "Generate, review, assign"],
          ].map(([number, title, body]) => (
            <li
              key={number}
              className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--brand-500)] text-xs font-bold text-white">
                  {number}
                </span>
                <span className="font-semibold text-white">{title}</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">{body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {coverage?.map((item) => (
            <div
              key={item.country}
              className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3"
            >
              <div className="flex justify-between gap-2">
                <p className="font-medium text-white">{item.country}</p>
                <Pill value={item.status}>{label(item.status)}</Pill>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                {item.rowCount?.toLocaleString() ?? "No"} rows ·{" "}
                {label(item.confidence)} confidence
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {item.fetchedAt
                  ? `Snapshot ${new Date(item.fetchedAt).toLocaleDateString()}`
                  : item.accessMode === "targeted_check"
                    ? "Document each official product check"
                    : "Complete snapshot required"}
              </p>
            </div>
          ))}
        </div>
      </header>
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={queue === "working" ? "default" : "outline"}
            onClick={() => setQueue("working")}
          >
            Top-20 working queue
          </Button>
          <Button
            variant={queue === "watchlist" ? "default" : "outline"}
            onClick={() => setQueue("watchlist")}
          >
            Watchlist
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
          <label className="relative">
            <span className="sr-only">Search pursuits</span>
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product, owner or therapy"
              className="border-zinc-600 bg-zinc-950 pl-9 text-white"
            />
          </label>
          <label>
            <span className="sr-only">Stage</span>
            <select
              value={stage}
              onChange={(event) =>
                setStage(event.target.value as Stage | "All")
              }
              className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option>All</option>
              {STAGES.map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Country</span>
            <select
              value={country}
              onChange={(event) =>
                setCountry(event.target.value as Country | "All")
              }
              className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option>All</option>
              {COUNTRIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {feedback ? (
        <div className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {feedback}
        </div>
      ) : null}
      <div className="space-y-4">
        {rows === undefined ? (
          <p className="py-12 text-center text-zinc-400">
            Loading evidence queue…
          </p>
        ) : rows.filter(Boolean).length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-600 p-10 text-center">
            <ShieldCheck className="mx-auto h-6 w-6 text-zinc-500" />
            <p className="mt-3 font-medium text-white">
              No evidence-safe pursuits in this view
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Approve a presentation-complete reference source, then materialize
              reviewed candidates. UAE will compare automatically; Saudi and
              Egypt will open targeted-check work. Historical candidates remain
              preserved but quarantined.
            </p>
          </div>
        ) : (
          rows.map((row) => {
            if (!row) return null;
            const opportunity = row.opportunity;
            return (
              <article
                key={opportunity._id}
                className="rounded-xl border border-zinc-700 bg-zinc-900 p-5"
              >
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <div className="flex gap-2">
                      <Pill value={opportunity.funnelStage}>
                        {label(opportunity.funnelStage ?? "needs_evidence")}
                      </Pill>
                      <Pill value="accepted">v1.1 evidence</Pill>
                    </div>
                    <Link
                      href={`/opportunities/${opportunity._id}`}
                      className="mt-3 block text-xl font-semibold text-white hover:text-[var(--brand-300)]"
                    >
                      {opportunity.productName}
                    </Link>
                    <p className="mt-1 text-sm text-zinc-300">
                      {opportunity.genericName} ·{" "}
                      {opportunity.approachEntityName}
                    </p>
                  </div>
                  <p className="text-sm text-zinc-400">
                    Score{" "}
                    <strong className="text-xl text-white">
                      {opportunity.priorityScore}
                    </strong>
                    /100
                  </p>
                </div>
                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  {row.assessments.map((assessment) => (
                    <section
                      key={assessment._id}
                      className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-4"
                    >
                      <div className="flex justify-between gap-2">
                        <h2 className="font-semibold text-white">
                          {assessment.country}
                        </h2>
                        <Pill value={assessment.absenceConfidence}>
                          {label(assessment.absenceConfidence ?? "low")}{" "}
                          confidence
                        </Pill>
                      </div>
                      <p className="mt-3 text-sm text-zinc-300">
                        {assessment.presenceStatement}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {assessment.gateSnapshot
                          ? Object.entries(assessment.gateSnapshot)
                              .filter(([key]) => key.startsWith("g"))
                              .map(([key, value]) => (
                                <Pill key={key} value={String(value)}>
                                  {key.slice(0, 2).toUpperCase()}{" "}
                                  {String(value)}
                                </Pill>
                              ))
                          : null}
                      </div>
                      <p className="mt-3 text-xs text-zinc-400">
                        Reason:{" "}
                        {label(assessment.companyReasonCode ?? "UNCLASSIFIED")}{" "}
                        · Economics:{" "}
                        {label(
                          assessment.commercialApprovalStatus ??
                            "not_requested",
                        )}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setReviewTarget({
                              opportunity,
                              assessment,
                              country: assessment.country as Country,
                            })
                          }
                        >
                          Verify evidence
                        </Button>
                        {assessment.commercialApprovalStatus ===
                        "provisional" ? (
                          <>
                            <Input
                              aria-label={`Approval note for ${assessment.country}`}
                              value={notes[assessment._id] ?? ""}
                              onChange={(event) =>
                                setNotes((current) => ({
                                  ...current,
                                  [assessment._id]: event.target.value,
                                }))
                              }
                              placeholder="Approval note"
                              className="h-9 border-zinc-600 bg-zinc-900 text-xs text-white"
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                const note = notes[assessment._id]?.trim();
                                if (!note)
                                  return setFeedback(
                                    "Add a commercial approval note first.",
                                  );
                                void approveCommercial({
                                  assessmentId: assessment._id,
                                  approvalNote: note,
                                }).then(() =>
                                  setFeedback(
                                    "G6 approved for this pursuit only.",
                                  ),
                                );
                              }}
                            >
                              Approve G6
                            </Button>
                          </>
                        ) : null}
                        {assessment.stage === "qualified" &&
                        assessment.commercialApprovalStatus === "approved" ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              void promote({
                                opportunityId: opportunity._id,
                                assessmentId: assessment._id,
                              }).then((result) =>
                                setFeedback(
                                  result.promoted
                                    ? "Contact Ready approved. Nothing was generated or sent."
                                    : result.blockers.join(" "),
                                ),
                              )
                            }
                          >
                            Approve Contact Ready
                          </Button>
                        ) : null}
                        {assessment.stage === "contact_ready" &&
                        !opportunity.outreachPackage ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              void generate({
                                opportunityId: opportunity._id,
                                assessmentId: assessment._id,
                              }).then(() =>
                                setFeedback(
                                  "Cited outreach material generated for review. Nothing was sent.",
                                ),
                              )
                            }
                          >
                            Generate outreach
                          </Button>
                        ) : null}
                      </div>
                    </section>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-700 pt-4">
                  <p className="mr-auto text-xs text-zinc-300">
                    {row.contact
                      ? `${row.contact.name} · verified ${new Date(row.contact.verifiedAt).toLocaleDateString()}`
                      : "No current named contact"}
                  </p>
                  <Link
                    href={`/drugs/${opportunity.drugId}`}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-600 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                  >
                    Research product sources
                  </Link>
                  {opportunity.funnelStage === "contact_ready" &&
                  opportunity.outreachPackage ? (
                    <>
                      <label>
                        <span className="sr-only">Assign BD owner</span>
                        <select
                          id={`assignee-${opportunity._id}`}
                          defaultValue=""
                          className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-xs text-white"
                        >
                          <option value="" disabled>
                            Select BD owner
                          </option>
                          {members?.map((member) => (
                            <option
                              key={member.memberId}
                              value={member.memberId}
                            >
                              {member.name ?? member.email}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        size="sm"
                        onClick={() => {
                          const node = document.getElementById(
                            `assignee-${opportunity._id}`,
                          ) as HTMLSelectElement | null;
                          if (node?.value)
                            void assign({
                              opportunityId: opportunity._id,
                              memberId: node.value as Id<"workspaceMembers">,
                              contactId: row.contact?._id,
                            }).then((result) =>
                              setFeedback(
                                `${result.tasksCreated} human follow-up tasks created; nothing was sent.`,
                              ),
                            );
                        }}
                      >
                        Assign <ArrowRight className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
