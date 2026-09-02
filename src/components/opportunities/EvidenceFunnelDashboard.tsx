"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AlertTriangle, CheckCircle2, Clock3, Contact, FileCheck2, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const COUNTRIES = ["UAE", "Saudi Arabia", "Egypt"] as const;
const STAGES = ["needs_evidence", "qualified", "contact_ready", "assigned", "contacted", "engaged", "diligence", "negotiating", "won", "watching", "disqualified", "lost"] as const;
type Country = (typeof COUNTRIES)[number];
type Stage = (typeof STAGES)[number];

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stageClass(stage: string) {
  if (["contact_ready", "assigned", "contacted", "engaged", "diligence", "negotiating", "won"].includes(stage)) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (stage === "qualified") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  if (["watching", "needs_evidence"].includes(stage)) return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

type ReviewTarget = { opportunity: Record<string, unknown>; assessment?: Record<string, unknown>; country: Country };

function AssessmentReview({ target, onClose }: { target: ReviewTarget; onClose: () => void }) {
  const review = useMutation(api.evidenceFunnel.reviewAssessment);
  const addEvidence = useMutation(api.evidenceFunnel.addEvidence);
  const verifyContact = useMutation(api.evidenceFunnel.verifyContact);
  const opportunity = target.opportunity;
  const assessment = target.assessment;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const defaults = useMemo(() => ({
    registrationStatus: String(assessment?.registrationStatus ?? "unverified"),
    rightsStatus: String(assessment?.rightsStatus ?? "needs_review"),
    economicsStatus: String(assessment?.economicsStatus ?? "unvalidated"),
    demandStrength: String(assessment?.demandStrength ?? "none"),
  }), [assessment]);

  async function submit(formData: FormData) {
    setSaving(true);
    setMessage(undefined);
    try {
      const assessmentId = await review({
        opportunityId: String(opportunity._id) as Id<"decisionOpportunities">,
        country: target.country,
        productIdentityConfirmed: formData.get("productIdentityConfirmed") === "on",
        ownerConfirmed: formData.get("ownerConfirmed") === "on",
        registrationStatus: String(formData.get("registrationStatus")) as "registered" | "under_registration" | "verified_absent" | "not_found_unverified" | "unverified",
        registrationEvidence: String(formData.get("registrationEvidence") ?? ""),
        rightsStatus: String(formData.get("rightsStatus")) as "clear_no_conflict_found" | "conflict" | "unknown" | "needs_review",
        presenceStatement: String(formData.get("presenceStatement") ?? ""),
        agentPartnerEvidence: String(formData.get("agentPartnerEvidence") ?? ""),
        demandStrength: String(formData.get("demandStrength")) as "strong" | "medium" | "weak" | "none",
        strongSignalCount: Number(formData.get("strongSignalCount") ?? 0),
        mediumSignalCount: Number(formData.get("mediumSignalCount") ?? 0),
        demandSummary: String(formData.get("demandSummary") ?? ""),
        competitionSummary: String(formData.get("competitionSummary") ?? ""),
        economicsStatus: String(formData.get("economicsStatus")) as "evidence_backed" | "conservative_range" | "unvalidated",
        economicsSummary: String(formData.get("economicsSummary") ?? ""),
        feasibilityReviewed: formData.get("feasibilityReviewed") === "on",
        feasibilitySummary: String(formData.get("feasibilitySummary") ?? ""),
        blockers: String(formData.get("blockers") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
        scoreBreakdown: {
          gapValidity: Number(formData.get("gapValidity") ?? 0), commercialValue: Number(formData.get("commercialValue") ?? 0),
          urgencyDemand: Number(formData.get("urgencyDemand") ?? 0), regulatoryFeasibility: Number(formData.get("regulatoryFeasibility") ?? 0),
          partnerRightsReachability: Number(formData.get("partnerRightsReachability") ?? 0), evidenceConfidence: Number(formData.get("evidenceConfidence") ?? 0),
        },
        criticalReviewOpen: formData.get("criticalReviewOpen") === "on",
        evidenceObservedAt: new Date(String(formData.get("evidenceObservedAt"))).getTime(),
        staleAfter: new Date(String(formData.get("staleAfter"))).getTime(),
      });
      const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
      const sourceTitle = String(formData.get("sourceTitle") ?? "").trim();
      if (sourceUrl && sourceTitle) {
        await addEvidence({
          opportunityId: String(opportunity._id) as Id<"decisionOpportunities">,
          assessmentId,
          title: sourceTitle,
          sourceUrl,
          sourceType: String(formData.get("sourceType") ?? "official_signal"),
          evidenceStrength: String(formData.get("evidenceStrength")) as "strong" | "medium" | "supporting",
          observedAt: new Date(String(formData.get("evidenceObservedAt"))).getTime(),
          parserVersion: "analyst-reviewed-v1",
          confidence: "confirmed",
          reviewState: "approved",
        });
      }
      const contactName = String(formData.get("contactName") ?? "").trim();
      const contactSourceUrl = String(formData.get("contactSourceUrl") ?? "").trim();
      if (contactName && contactSourceUrl) {
        await verifyContact({
          opportunityId: String(opportunity._id) as Id<"decisionOpportunities">,
          name: contactName,
          title: String(formData.get("contactTitle") ?? "").trim(),
          role: String(formData.get("contactRole")) as "business_development" | "international_markets" | "licensing" | "commercial" | "executive",
          email: String(formData.get("contactEmail") ?? "").trim() || undefined,
          linkedinUrl: String(formData.get("contactLinkedinUrl") ?? "").trim() || undefined,
          sourceUrl: contactSourceUrl,
          sourceKind: String(formData.get("contactSourceKind")) as "company_website" | "company_press_release" | "conference" | "linkedin" | "manual",
          verifiedAt: Date.now(),
        });
      }
      setMessage("Assessment saved. Contact-ready gates will be checked separately.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not save assessment");
    } finally {
      setSaving(false);
    }
  }

  const score = (key: string) => Number((assessment?.scoreBreakdown as Record<string, unknown> | undefined)?.[key] ?? 0);
  const dateValue = (timestamp: unknown, fallbackDays = 0) => new Date(Number(timestamp ?? Date.now() + fallbackDays * 86_400_000)).toISOString().slice(0, 10);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-4 sm:p-8">
      <form action={submit} className="mx-auto max-w-4xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-200 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-300)]">Analyst evidence review</p><h2 className="mt-2 text-2xl font-semibold text-white">{String(opportunity.productName)} · {target.country}</h2></div>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <fieldset className="space-y-3 rounded-xl border border-zinc-800 p-4"><legend className="px-2 text-sm font-semibold">Identity and presence</legend>
            <label className="flex gap-2 text-sm"><input name="productIdentityConfirmed" type="checkbox" defaultChecked={Boolean(assessment?.productIdentityConfirmed)} /> Product identity confirmed from official evidence</label>
            <label className="flex gap-2 text-sm"><input name="ownerConfirmed" type="checkbox" defaultChecked={Boolean(assessment?.ownerConfirmed)} /> Owner / licensor confirmed</label>
            <Select name="registrationStatus" label="Registration status" defaultValue={defaults.registrationStatus} options={["unverified", "not_found_unverified", "verified_absent", "under_registration", "registered"]} />
            <Text name="registrationEvidence" label="Registration evidence" defaultValue={String(assessment?.registrationEvidence ?? "")} />
            <Select name="rightsStatus" label="Agent / rights status" defaultValue={defaults.rightsStatus} options={["needs_review", "unknown", "clear_no_conflict_found", "conflict"]} />
            <Text name="presenceStatement" label="Dated presence conclusion" defaultValue={String(assessment?.presenceStatement ?? `Review pending as of ${new Date().toISOString().slice(0, 10)}.`)} />
            <Text name="agentPartnerEvidence" label="Agent / partner evidence" defaultValue={String(assessment?.agentPartnerEvidence ?? "")} />
          </fieldset>
          <fieldset className="space-y-3 rounded-xl border border-zinc-800 p-4"><legend className="px-2 text-sm font-semibold">Demand and market case</legend>
            <Select name="demandStrength" label="Demand strength" defaultValue={defaults.demandStrength} options={["none", "weak", "medium", "strong"]} />
            <div className="grid grid-cols-2 gap-3"><NumberField name="strongSignalCount" label="Strong signals" defaultValue={Number(assessment?.strongSignalCount ?? 0)} /><NumberField name="mediumSignalCount" label="Medium signals" defaultValue={Number(assessment?.mediumSignalCount ?? 0)} /></div>
            <Text name="demandSummary" label="Why now / demand evidence" defaultValue={String(assessment?.demandSummary ?? opportunity.whyNow ?? "")} />
            <Text name="competitionSummary" label="Competition" defaultValue={String(assessment?.competitionSummary ?? opportunity.competitivePressure ?? "")} />
            <Select name="economicsStatus" label="Commercial sizing status" defaultValue={defaults.economicsStatus} options={["unvalidated", "conservative_range", "evidence_backed"]} />
            <Text name="economicsSummary" label="Sizing and assumptions" defaultValue={String(assessment?.economicsSummary ?? opportunity.marketSizeEstimate ?? "UNVALIDATED")} />
          </fieldset>
          <fieldset className="space-y-3 rounded-xl border border-zinc-800 p-4"><legend className="px-2 text-sm font-semibold">Feasibility and governance</legend>
            <label className="flex gap-2 text-sm"><input name="feasibilityReviewed" type="checkbox" defaultChecked={Boolean(assessment?.feasibilityReviewed)} /> Registration and route-to-market feasibility reviewed</label>
            <Text name="feasibilitySummary" label="Feasibility conclusion" defaultValue={String(assessment?.feasibilitySummary ?? opportunity.entryStrategyRationale ?? "")} />
            <Text name="blockers" label="Blockers, one per line" defaultValue={Array.isArray(assessment?.blockers) ? assessment.blockers.join("\n") : ""} />
            <label className="flex gap-2 text-sm"><input name="criticalReviewOpen" type="checkbox" defaultChecked={assessment ? Boolean(assessment.criticalReviewOpen) : true} /> Critical review item remains open</label>
            <label className="block text-xs text-zinc-400">Evidence observed<input name="evidenceObservedAt" type="date" required defaultValue={dateValue(assessment?.evidenceObservedAt)} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 p-2" /></label>
            <label className="block text-xs text-zinc-400">Fresh until<input name="staleAfter" type="date" required defaultValue={dateValue(assessment?.staleAfter, 90)} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 p-2" /></label>
            <div className="border-t border-zinc-800 pt-3"><p className="mb-2 text-xs font-semibold text-zinc-300">Approve a source with this review (optional)</p><input name="sourceTitle" placeholder="Source title" className="mb-2 w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-sm" /><input name="sourceUrl" type="url" placeholder="https://official-source…" className="mb-2 w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-sm" /><div className="grid grid-cols-2 gap-2"><select name="sourceType" defaultValue="official_signal" className="rounded border border-zinc-800 bg-zinc-950 p-2 text-sm"><option value="official_signal">Official signal</option><option value="official_registry">Official registry</option><option value="authorized_export">Authorized export</option><option value="independent_market">Independent market source</option></select><select name="evidenceStrength" defaultValue="strong" className="rounded border border-zinc-800 bg-zinc-950 p-2 text-sm"><option value="strong">Strong</option><option value="medium">Medium</option><option value="supporting">Supporting</option></select></div></div>
          </fieldset>
          <fieldset className="space-y-3 rounded-xl border border-zinc-800 p-4"><legend className="px-2 text-sm font-semibold">Weighted score · 70 required</legend>
            {["gapValidity", "commercialValue", "urgencyDemand", "regulatoryFeasibility", "partnerRightsReachability", "evidenceConfidence"].map((key) => <NumberField key={key} name={key} label={label(key)} defaultValue={score(key)} max={100} />)}
            <p className="text-xs leading-relaxed text-zinc-500">Weights: gap 25, value 20, urgency 15, feasibility 15, rights/reachability 15, confidence 10.</p>
            <div className="border-t border-zinc-800 pt-3"><p className="mb-2 text-xs font-semibold text-zinc-300">Verify named contact (optional)</p><input name="contactName" placeholder="Full name" className="mb-2 w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-sm" /><input name="contactTitle" placeholder="Current title" className="mb-2 w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-sm" /><select name="contactRole" defaultValue="business_development" className="mb-2 w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-sm"><option value="business_development">Business development</option><option value="international_markets">International markets</option><option value="licensing">Licensing</option><option value="commercial">Commercial</option><option value="executive">Executive</option></select><div className="grid gap-2 sm:grid-cols-2"><input name="contactEmail" type="email" placeholder="Public email" className="rounded border border-zinc-800 bg-zinc-950 p-2 text-sm" /><input name="contactLinkedinUrl" type="url" placeholder="Direct LinkedIn URL" className="rounded border border-zinc-800 bg-zinc-950 p-2 text-sm" /></div><input name="contactSourceUrl" type="url" placeholder="Verification source URL" className="mt-2 w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-sm" /><select name="contactSourceKind" defaultValue="company_website" className="mt-2 w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-sm"><option value="company_website">Company website</option><option value="company_press_release">Company press release</option><option value="conference">Conference material</option><option value="linkedin">LinkedIn</option><option value="manual">Other public source</option></select></div>
          </fieldset>
        </div>
        {message && <p className="mt-5 rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm">{message}</p>}
        <div className="mt-6 flex justify-end"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save analyst review"}</Button></div>
      </form>
    </div>
  );
}

function Text({ name, label: textLabel, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return <label className="block text-xs text-zinc-400">{textLabel}<textarea name={name} required defaultValue={defaultValue} rows={2} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-sm text-white" /></label>;
}
function Select({ name, label: textLabel, defaultValue, options }: { name: string; label: string; defaultValue: string; options: string[] }) {
  return <label className="block text-xs text-zinc-400">{textLabel}<select name={name} defaultValue={defaultValue} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-sm text-white">{options.map((option) => <option key={option} value={option}>{label(option)}</option>)}</select></label>;
}
function NumberField({ name, label: textLabel, defaultValue, max }: { name: string; label: string; defaultValue: number; max?: number }) {
  return <label className="block text-xs text-zinc-400">{textLabel}<input name={name} type="number" min={0} max={max} required defaultValue={defaultValue} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-sm text-white" /></label>;
}

export function EvidenceFunnelDashboard({ initialStage = "All" }: { initialStage?: Stage | "All" }) {
  const [stage, setStage] = useState<Stage | "All">(initialStage);
  const [targetCountry, setTargetCountry] = useState<Country | "All">("All");
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget>();
  const [feedback, setFeedback] = useState<string>();
  const stats = useQuery(api.evidenceFunnel.stats);
  const rows = useQuery(api.evidenceFunnel.list, { stage: stage === "All" ? undefined : stage, targetCountry: targetCountry === "All" ? undefined : targetCountry, limit: 100 });
  const members = useQuery(api.workspaceMembers.listAssignable);
  const sourceHealth = useQuery(api.continuousOpportunityEngine.listSourceHealth);
  const promote = useMutation(api.evidenceFunnel.promoteContactReady);
  const assign = useMutation(api.evidenceFunnel.assign);

  async function promoteAssessment(opportunityId: Id<"decisionOpportunities">, assessmentId: Id<"opportunityMarketAssessments">) {
    const result = await promote({ opportunityId, assessmentId });
    setFeedback(result.promoted ? "Approved as contact-ready. The outreach package is prepared but not sent." : result.blockers.join(" "));
  }

  return (
    <section className="space-y-6">
      {reviewTarget && <AssessmentReview target={reviewTarget} onClose={() => setReviewTarget(undefined)} />}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-300)]">Canonical evidence-to-outreach funnel</p><h1 className="mt-2 text-3xl font-semibold text-white">Find the gap. Prove it. Reach the right owner.</h1><p className="mt-3 text-sm leading-relaxed text-zinc-400">One product–company pursuit, reviewed separately for UAE, Saudi Arabia, and Egypt. A public “not found” is never treated as verified absence, and no message is sent automatically.</p></div><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"><span className="font-semibold">Monthly quality cap</span><br />{stats?.contactReadyThisMonth ?? 0} / 15 contact-ready</div></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[{ label: "Needs evidence", value: stats?.stages?.needs_evidence ?? 0, icon: FileCheck2 }, { label: "Qualified", value: stats?.stages?.qualified ?? 0, icon: CheckCircle2 }, { label: "Contact-ready", value: stats?.stages?.contact_ready ?? 0, icon: Contact }, { label: "Assigned + active", value: (stats?.stages?.assigned ?? 0) + (stats?.stages?.contacted ?? 0) + (stats?.stages?.engaged ?? 0), icon: UserRoundCheck }, { label: "Sources healthy", value: sourceHealth?.filter((source) => source.status === "active").length ?? 0, icon: Clock3 }].map((item) => <div key={item.label} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"><div className="flex justify-between"><p className="text-xs text-zinc-400">{item.label}</p><item.icon className="h-4 w-4 text-[var(--brand-300)]" /></div><p className="mt-2 text-2xl font-semibold text-white">{item.value}</p></div>)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4"><select value={stage} onChange={(event) => setStage(event.target.value as Stage | "All")} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"><option>All</option>{STAGES.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select><select value={targetCountry} onChange={(event) => setTargetCountry(event.target.value as Country | "All")} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"><option>All</option>{COUNTRIES.map((item) => <option key={item}>{item}</option>)}</select><span className="ml-auto text-xs text-zinc-500">{rows?.length ?? 0} pursuits shown</span></div>
      {feedback && <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>{feedback}</p></div>}

      <div className="space-y-4">
        {!rows ? <p className="py-12 text-center text-sm text-zinc-500">Loading funnel…</p> : rows.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-800 py-12 text-center text-sm text-zinc-500">No pursuits match these filters.</p> : rows.map((row) => {
          if (!row) return null;
          const opportunity = row.opportunity;
          const opportunityStage = opportunity.funnelStage ?? "needs_evidence";
          return <article key={opportunity._id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href={`/opportunities/${opportunity._id}`} className="text-xl font-semibold text-white hover:text-[var(--brand-300)]">{opportunity.productName}</Link><p className="mt-1 text-sm text-zinc-400">{opportunity.approachEntityName} · {opportunity.therapeuticArea}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-medium ${stageClass(opportunityStage)}`}>{label(opportunityStage)}</span></div>
            <div className="mt-5 grid gap-3 lg:grid-cols-3">{(row.assessments.length ? row.assessments : COUNTRIES.map((item) => ({ country: item }))).map((assessment) => {
              const existing = "_id" in assessment;
              return <div key={assessment.country} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4"><div className="flex items-center justify-between gap-3"><p className="font-medium text-white">{assessment.country}</p>{existing && <span className={`rounded border px-2 py-0.5 text-[11px] ${stageClass(assessment.stage)}`}>{assessment.weightedScore}/100</span>}</div>{existing ? <><p className="mt-3 line-clamp-2 text-xs leading-relaxed text-zinc-400">{assessment.presenceStatement}</p><p className="mt-2 text-xs text-zinc-500">Demand: {label(assessment.demandStrength)} · Sizing: {label(assessment.economicsStatus)}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setReviewTarget({ opportunity, assessment, country: assessment.country })}>Review evidence</Button>{assessment.stage === "qualified" && <Button size="sm" onClick={() => void promoteAssessment(opportunity._id, assessment._id)}>Check & promote</Button>}</div></> : <><p className="mt-3 text-xs leading-relaxed text-zinc-500">No country assessment yet. Start with official registration, rights, and demand evidence.</p><Button className="mt-4" size="sm" variant="outline" onClick={() => setReviewTarget({ opportunity, country: assessment.country })}>Start review</Button></>}</div>;
            })}</div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4"><div className="mr-auto text-xs text-zinc-400">{row.contact ? `${row.contact.name} · verified ${new Date(row.contact.verifiedAt).toLocaleDateString()}` : "No verified named contact"}</div>{opportunityStage === "contact_ready" && <><select id={`assignee-${opportunity._id}`} defaultValue="" className="rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-white"><option value="" disabled>Select BD owner</option>{members?.map((member) => <option key={member.memberId} value={member.memberId}>{member.name ?? member.email} · {member.role}</option>)}</select><Button size="sm" onClick={() => { const element = document.getElementById(`assignee-${opportunity._id}`) as HTMLSelectElement | null; if (element?.value) void assign({ opportunityId: opportunity._id, memberId: element.value as Id<"workspaceMembers">, contactId: row.contact?._id }).then((result) => setFeedback(`${result.tasksCreated} human follow-up tasks created.`)); }}>Assign & create tasks</Button></>}</div>
          </article>;
        })}
      </div>
    </section>
  );
}
