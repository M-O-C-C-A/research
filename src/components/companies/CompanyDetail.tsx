"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FindDrugsButton } from "@/components/discovery/FindDrugsButton";
import { GuidedFlowBanner } from "@/components/shared/GuidedFlowBanner";
import {
  Globe,
  MapPin,
  Star,
  Mail,
  Linkedin,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  Phone,
  Users,
  Send,
  ExternalLink,
  ShieldCheck,
  ShieldX,
  ShieldQuestion,
  Zap,
  ArrowRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizePipelineStage, PIPELINE_STAGES } from "@/lib/distributorFit";

type BdStatus = (typeof PIPELINE_STAGES)[number]["key"];

const BD_STAGES: { value: BdStatus; label: string }[] = PIPELINE_STAGES.map((stage) => ({
  value: stage.key,
  label: stage.label,
}));

const ACTIVITY_TYPES = [
  { value: "note", label: "Note", icon: MessageSquare },
  { value: "email_sent", label: "Email Sent", icon: Send },
  { value: "email_received", label: "Email Received", icon: Mail },
  { value: "call", label: "Call", icon: Phone },
  { value: "meeting", label: "Meeting", icon: Users },
] as const;

function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, typeof MessageSquare> = {
    note: MessageSquare,
    email_sent: Send,
    email_received: Mail,
    call: Phone,
    meeting: Users,
    stage_change: ChevronUp,
    deal_update: Star,
  };
  const Icon = map[type] ?? MessageSquare;
  return <Icon className="h-3.5 w-3.5 shrink-0" />;
}

// ── Drug MENA registration panel ─────────────────────────────────────────────

const MENA_STATUS_ICON = {
  registered: ShieldX,
  not_found: ShieldCheck,
  unverified: ShieldQuestion,
};
const MENA_STATUS_COLOR = {
  registered: "text-amber-400",
  not_found: "text-emerald-400",
  unverified: "text-zinc-500",
};
const MENA_STATUS_LABEL = {
  registered: "Already registered",
  not_found: "Not registered — opportunity",
  unverified: "Unverified",
};

function DrugMenaPanel({ companyId }: { companyId: Id<"companies"> }) {
  const drugs = useQuery(api.drugs.listByCompany, { companyId });

  const drugsWithMena = (drugs ?? []).filter(
    (d) => d.menaRegistrations && d.menaRegistrations.length > 0
  );

  if (!drugs || drugsWithMena.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-zinc-500" />
        MENA Drug Registration Status
      </h3>
      <div className="space-y-4">
        {drugsWithMena.map((drug) => {
          const regs = drug.menaRegistrations ?? [];
          const registeredCount = regs.filter((r) => r.status === "registered").length;
          const notFoundCount = regs.filter((r) => r.status === "not_found").length;
          return (
            <div key={drug._id}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-medium text-white">{drug.name}</p>
                <span className="text-xs text-zinc-600">/ {drug.genericName}</span>
                {registeredCount > 0 && (
                  <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded px-1.5 py-0.5">
                    {registeredCount} already in MENA
                  </span>
                )}
                {notFoundCount > 0 && registeredCount === 0 && (
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5">
                    Clean opportunity
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {regs.map((reg, i) => {
                  const Icon = MENA_STATUS_ICON[reg.status];
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs"
                      title={`${MENA_STATUS_LABEL[reg.status]}${reg.registrationNumber ? ` · Reg# ${reg.registrationNumber}` : ""}`}
                    >
                      <Icon className={`h-3 w-3 shrink-0 ${MENA_STATUS_COLOR[reg.status]}`} />
                      <span className="text-zinc-300">{reg.country}</span>
                      {reg.url ? (
                        <a
                          href={reg.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-600 hover:text-zinc-400 transition-colors"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-zinc-700 mt-3">
        <ShieldX className="h-3 w-3 inline text-amber-400 mr-1" />already registered ·{" "}
        <ShieldCheck className="h-3 w-3 inline text-emerald-400 mr-1" />not registered (opportunity) ·{" "}
        <ShieldQuestion className="h-3 w-3 inline text-zinc-500 mr-1" />unverified
      </p>
    </div>
  );
}

interface CompanyDetailProps {
  companyId: string;
}

export function CompanyDetail({ companyId }: CompanyDetailProps) {
  const company = useQuery(api.companies.get, {
    id: companyId as Id<"companies">,
  });
  const activities = useQuery(api.bdActivities.list, {
    companyId: companyId as Id<"companies">,
    limit: 20,
  });

  const updateCompany = useMutation(api.companies.update);
  const moveStage = useMutation(api.companies.moveStage);
  const addActivity = useMutation(api.bdActivities.create);
  const scoreCompany = useAction(api.discovery.scoreCompanyForBD);
  const buildDossier = useAction(api.research.buildProspectDossier);

  const [showBD, setShowBD] = useState(true);
  const [isScoring, setIsScoring] = useState(false);
  const [isDossierRunning, setIsDossierRunning] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [activityType, setActivityType] = useState<"note" | "email_sent" | "email_received" | "call" | "meeting">("note");
  const [savingNotes, setSavingNotes] = useState(false);
  const [bdNotes, setBdNotes] = useState<string | undefined>(undefined);

  if (company === undefined) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-3 mb-8">
        <Skeleton className="h-6 w-1/3 bg-zinc-800" />
        <Skeleton className="h-4 w-1/4 bg-zinc-800" />
        <Skeleton className="h-4 w-full bg-zinc-800" />
      </div>
    );
  }

  if (!company) return null;

  const effectiveNotes = bdNotes ?? company.bdNotes ?? "";

  async function handleScore() {
    setIsScoring(true);
    try {
      await scoreCompany({ companyId: companyId as Id<"companies"> });
    } finally {
      setIsScoring(false);
    }
  }

  async function handleBuildDossier() {
    setIsDossierRunning(true);
    try {
      await buildDossier({ companyId: companyId as Id<"companies"> });
    } finally {
      setIsDossierRunning(false);
    }
  }

  async function handleStageChange(newStatus: BdStatus) {
    await moveStage({ id: companyId as Id<"companies">, newStatus });
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    await addActivity({
      companyId: companyId as Id<"companies">,
      type: activityType,
      content: newNote.trim(),
    });
    setNewNote("");
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    await updateCompany({
      id: companyId as Id<"companies">,
      bdNotes: effectiveNotes,
    });
    setSavingNotes(false);
  }

  return (
    <div className="space-y-6 mb-8">
      <GuidedFlowBanner
        hereLabel="Company detail"
        helperText="Use this page to judge whether a target manufacturer is worth pursuing, then research the portfolio and move into the best opportunity."
      />

      {/* Main company card */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">{company.name}</h2>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-zinc-500">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {company.country}
              </span>
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Website
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/gaps"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
            >
              Review opportunities
              <ArrowRight className="h-4 w-4" />
            </Link>
            <FindDrugsButton companyId={companyId} label="Find products" />
            <Badge
              variant={company.status === "active" ? "default" : "secondary"}
              className={
                company.status === "active"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-zinc-800 text-zinc-400"
              }
            >
              {company.status}
            </Badge>
          </div>
        </div>

        {company.description && (
          <p className="text-sm text-zinc-400 mb-4">{company.description}</p>
        )}

        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-sm text-zinc-300">
            Use this page to decide whether this company is worth moving forward. Review its fit,
            products, and MENA position, then move into the opportunity or outreach flow once the
            case is strong enough.
          </p>
        </div>

        {company.therapeuticAreas.length > 0 && (
          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">
              Therapeutic Areas
            </p>
            <div className="flex flex-wrap gap-2">
              {company.therapeuticAreas.map((area) => (
                <Badge
                  key={area}
                  variant="secondary"
                  className="bg-zinc-800 text-zinc-300 border-0"
                >
                  {area}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Distributor Fit Panel */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900">
        <button
          onClick={() => setShowBD((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-zinc-300 uppercase tracking-wider hover:bg-zinc-800/50 transition-colors rounded-lg"
        >
          <span className="flex items-center gap-2">
            <Star className="h-4 w-4 text-orange-400" />
            Distributor Fit
            {(company.distributorFitScore ?? company.bdScore) != null && (
              <span className="text-orange-400 font-bold">{(company.distributorFitScore ?? company.bdScore)?.toFixed(1)}/10</span>
            )}
          </span>
          {showBD ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showBD && (
          <div className="px-6 pb-6 space-y-5 border-t border-zinc-800 pt-4">
            {/* Stage + Score row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-zinc-500 mb-1.5">Pipeline Stage</p>
                <Select
                  value={normalizePipelineStage(company.bdStatus)}
                  onValueChange={(v) => handleStageChange(v as BdStatus)}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {BD_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-1.5">Company Size</p>
                <div className="h-9 flex items-center">
                  <span className={`text-sm px-2 py-1 rounded ${
                    (company.targetSegment ?? company.companySize) === "sme"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : (company.targetSegment ?? company.companySize) === "mid"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : (company.targetSegment ?? company.companySize) === "large"
                          ? "bg-red-500/10 text-red-400"
                          : "text-zinc-500"
                  }`}>
                    {company.targetSegment ?? company.companySize ?? "Unknown"}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-1.5">MENA Channel</p>
                <div className="h-9 flex items-center">
                  <span className={`text-sm px-2 py-1 rounded ${
                    (company.menaChannelStatus ?? company.menaPresence) === "none"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : (company.menaChannelStatus ?? company.menaPresence) === "limited"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : (company.menaChannelStatus ?? company.menaPresence) === "established"
                          ? "bg-red-500/10 text-red-400"
                          : "text-zinc-500"
                  }`}>
                    {company.menaChannelStatus ?? company.menaPresence ?? "Unknown"}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-1.5">Distributor Fit</p>
                <div className="flex items-center gap-2 h-9">
                  {(company.distributorFitScore ?? company.bdScore) != null ? (
                    <span className="text-xl font-bold text-white">
                      {(company.distributorFitScore ?? company.bdScore)?.toFixed(1)}
                      <span className="text-sm text-zinc-500">/10</span>
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-500">Not scored</span>
                  )}
                </div>
              </div>
            </div>

            {/* Score rationale */}
            {(company.distributorFitRationale ?? company.bdScoreRationale) && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Assessment</p>
                <p className="text-sm text-zinc-400 leading-relaxed">{company.distributorFitRationale ?? company.bdScoreRationale}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-zinc-500 mb-1.5">Entity Roles</p>
                <div className="flex flex-wrap gap-1.5">
                  {(company.entityRoles ?? []).length > 0 ? (
                    company.entityRoles?.map((role) => (
                      <Badge key={role} className="border-0 bg-zinc-800 text-zinc-300">
                        {role.replaceAll("_", " ")}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-zinc-500">Unknown</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1.5">Commercial Control</p>
                <p className="text-sm text-zinc-300">
                  {company.commercialControlLevel ?? "unknown"}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1.5">MENA Partner Strength</p>
                <p className="text-sm text-zinc-300">
                  {company.menaPartnershipStrength ?? "unknown"}
                </p>
              </div>
            </div>

            {(company.approachTargetRecommendation || company.approachTargetReason) && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  Approach Recommendation
                </p>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {company.approachTargetRecommendation && (
                    <Badge className={`border-0 ${
                      company.approachTargetRecommendation === "approach"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : company.approachTargetRecommendation === "watch"
                          ? "bg-yellow-500/10 text-yellow-300"
                          : "bg-red-500/10 text-red-300"
                    }`}>
                      {company.approachTargetRecommendation}
                    </Badge>
                  )}
                  {company.notApproachableReason && (
                    <span className="text-xs text-red-300">{company.notApproachableReason}</span>
                  )}
                </div>
                {company.approachTargetReason && (
                  <p className="text-sm text-zinc-400">{company.approachTargetReason}</p>
                )}
              </div>
            )}

            {company.disqualifierReasons && company.disqualifierReasons.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Disqualifiers / Watchouts</p>
                <div className="flex flex-wrap gap-1.5">
                  {company.disqualifierReasons.map((reason) => (
                    <Badge key={reason} className="border-0 bg-red-500/10 text-red-300">
                      {reason}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {company.existingMenaPartners && company.existingMenaPartners.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  Existing MENA Partners
                </p>
                <div className="space-y-2">
                  {company.existingMenaPartners.map((partner) => (
                    <div
                      key={`${partner.name}-${partner.role}`}
                      className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-white">{partner.name}</span>
                        <Badge className="border-0 bg-zinc-800 text-zinc-300">
                          {partner.role.replaceAll("_", " ")}
                        </Badge>
                        <span className="text-xs text-zinc-500">
                          {partner.geographies.join(", ")}
                        </span>
                        {partner.exclusivity && (
                          <span className="text-xs text-zinc-500">
                            {partner.exclusivity.replaceAll("_", " ")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {partner.confidence}
                        {partner.source ? ` · ${partner.source}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Revenue / employees */}
            {(company.revenueEstimate || company.employeeCount) && (
              <div className="flex gap-6">
                {company.revenueEstimate && (
                  <div>
                    <p className="text-xs text-zinc-500">Revenue</p>
                    <p className="text-sm text-zinc-300">{company.revenueEstimate}</p>
                  </div>
                )}
                {company.employeeCount && (
                  <div>
                    <p className="text-xs text-zinc-500">Employees</p>
                    <p className="text-sm text-zinc-300">{company.employeeCount}</p>
                  </div>
                )}
              </div>
            )}

            {/* Evidence items */}
            {company.bdEvidenceItems && company.bdEvidenceItems.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  Research Evidence
                </p>
                <div className="space-y-1.5">
                  {company.bdEvidenceItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-emerald-500 shrink-0 mt-0.5">·</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-zinc-300">{item.claim}</span>
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-[var(--brand-300)] hover:text-[var(--brand-400)] transition-colors"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            {item.source}
                          </a>
                        ) : (
                          <span className="ml-1.5 text-xs text-zinc-600">{item.source}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contacts — prefer keyContacts array, fall back to single contact */}
            {((company.keyContacts && company.keyContacts.length > 0) ||
              company.contactName) && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  Key Contacts
                  {company.linkedinCompanyUrl && (
                    <a
                      href={company.linkedinCompanyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-1 text-[var(--brand-300)] hover:text-[var(--brand-400)] transition-colors normal-case"
                    >
                      <Linkedin className="h-2.5 w-2.5" />
                      Company page
                    </a>
                  )}
                </p>
                <div className="space-y-2">
                  {(company.keyContacts && company.keyContacts.length > 0
                    ? company.keyContacts
                    : company.contactName
                      ? [{
                          name: company.contactName,
                          title: company.contactTitle ?? "",
                          roleType: "business_development" as const,
                          seniority: "unknown" as const,
                          geographies: [],
                          email: company.contactEmail,
                          linkedinUrl: company.linkedinUrl,
                          confidence: "likely" as const,
                          source: undefined,
                          lastVerifiedAt: undefined,
                        }]
                      : []
                  ).map((contact, i) => (
                    <div key={i} className="rounded-md bg-zinc-800 px-3 py-2.5 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-white">{contact.name}</span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              contact.confidence === "confirmed"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : contact.confidence === "likely"
                                  ? "bg-[color:var(--brand-surface)] text-[var(--brand-300)]"
                                  : "bg-zinc-700 text-zinc-500"
                            }`}
                          >
                            {contact.confidence}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{contact.title}</p>
                        {(contact.roleType || (contact.geographies?.length ?? 0) > 0) && (
                          <p className="text-xs text-zinc-600 mt-0.5">
                            {contact.roleType
                              ? contact.roleType.replaceAll("_", " ")
                              : "contact"}
                            {(contact.geographies?.length ?? 0) > 0
                              ? ` · ${contact.geographies?.join(", ")}`
                              : ""}
                          </p>
                        )}
                        {contact.source && (
                          <p className="text-xs text-zinc-700 mt-0.5 truncate">via {contact.source}</p>
                        )}
                        {contact.lastVerifiedAt && (
                          <p className="text-xs text-zinc-700 mt-0.5">
                            verified {new Date(contact.lastVerifiedAt).toLocaleDateString()}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          {contact.email && (
                            <a
                              href={`mailto:${contact.email}`}
                              className="flex items-center gap-1 text-xs text-[var(--brand-300)] hover:text-[var(--brand-400)] transition-colors"
                            >
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </a>
                          )}
                          {contact.linkedinUrl && (
                            <a
                              href={contact.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-[var(--brand-300)] hover:text-[var(--brand-400)] transition-colors"
                            >
                              <Linkedin className="h-3 w-3" />
                              LinkedIn
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pursuit Notes */}
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">Pursuit Notes</p>
              <textarea
                value={effectiveNotes}
                onChange={(e) => setBdNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Add notes about fit, outreach, objections, documents, and next steps..."
                className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded p-3 text-zinc-300 resize-none h-24 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
              />
              {savingNotes && (
                <p className="text-xs text-zinc-600 mt-0.5">Saving...</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={handleBuildDossier}
                disabled={isDossierRunning || isScoring}
                className="bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white"
              >
                {isDossierRunning ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Building dossier…</>
                ) : (
                  <><Zap className="h-3 w-3 mr-1.5" />Research this company</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleScore}
                disabled={isScoring || isDossierRunning}
                className="border-zinc-700 hover:bg-zinc-800"
              >
                {isScoring ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Scoring…</>
                ) : (
                  <><Star className="h-3 w-3 mr-1.5" />Quick fit check</>
                )}
              </Button>
              <div className="flex items-center gap-3 ml-auto">
                {company.researchedAt && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Researched {new Date(company.researchedAt).toLocaleDateString()}
                  </span>
                )}
                {!company.researchedAt && company.bdScoredAt && (
                  <span className="text-xs text-zinc-600 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Scored {new Date(company.bdScoredAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drug MENA Registration Status */}
      <DrugMenaPanel companyId={companyId as Id<"companies">} />

      {/* Activity Timeline */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
          Activity Log
        </h3>

        {/* Add activity form */}
        <div className="space-y-2 mb-4">
          <div className="flex gap-2">
            <Select
              value={activityType}
              onValueChange={(v) => setActivityType(v as typeof activityType)}
            >
              <SelectTrigger className="w-36 bg-zinc-800 border-zinc-700 text-white h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
              placeholder="Log an activity or note..."
              className="flex-1 text-sm bg-zinc-800 border border-zinc-700 rounded px-3 h-9 text-white focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
            />
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              className="h-9 bg-zinc-700 hover:bg-zinc-600 shrink-0"
            >
              Log
            </Button>
          </div>
        </div>

        {/* Activity list */}
        {activities === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-4">
            No activities logged yet
          </p>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div
                key={activity._id}
                className="flex items-start gap-2.5 text-sm"
              >
                <div className="mt-0.5 text-zinc-600">
                  <ActivityIcon type={activity.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 leading-snug">{activity.content}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {activity.type.replace("_", " ")} ·{" "}
                    {new Date(activity.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
