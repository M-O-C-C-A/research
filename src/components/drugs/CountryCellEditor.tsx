"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AVAILABILITY_STATUS_OPTIONS,
  COMMERCIAL_OPPORTUNITY_KIND_OPTIONS,
  COMMERCIAL_SIGNAL_TYPE_OPTIONS,
  COMPETITION_INTENSITY_OPTIONS,
  COMPETITOR_PRESENCE_OPTIONS,
  ENTRY_STRATEGY_CHANNEL_OPTIONS,
  ENTRY_STRATEGY_SEQUENCING_OPTIONS,
  MARKET_MODEL_LEVEL_OPTIONS,
  MARKET_ACCESS_ROUTE_OPTIONS,
  PRICE_POSITIONING_OPTIONS,
  PRICE_SOURCE_CATEGORY_OPTIONS,
  PRICE_SOURCE_SYSTEM_OPTIONS,
  PRICE_TYPE_OPTIONS,
  PRICING_CONFIDENCE_OPTIONS,
  REGULATORY_STATUS_OPTIONS,
  SIGNAL_STRENGTH_OPTIONS,
} from "@/lib/constants";

const WEBSITE_SOURCE_TYPE_OPTIONS = [
  { value: "official_registry", label: "Official Registry" },
  { value: "tender_portal", label: "Tender Portal" },
  { value: "public_procurement", label: "Public Procurement" },
  { value: "essential_medicines", label: "Essential Medicines" },
  { value: "market_report", label: "Market Report" },
  { value: "company", label: "Company Website" },
  { value: "internal", label: "Internal Note" },
] as const;

const EVIDENCE_CONFIDENCE_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "likely", label: "Likely" },
  { value: "inferred", label: "Inferred" },
] as const;

interface CountryOpportunity {
  drugId: Id<"drugs">;
  country: string;
  opportunityScore?: number;
  regulatoryStatus?: string;
  competitorPresence?: string;
  marketSizeEstimate?: string;
  availabilityStatus?: string;
  treatmentVolumeProxy?: string;
  priceCorridor?: string;
  primaryPriceBenchmark?: string;
  pricingConfidence?: string;
  pricePositioning?: string;
  competitionIntensity?: string;
  competitivePriceSummary?: string;
  euReferenceAnchor?: string;
  gccRegisteredAnchor?: string;
  tenderBenchmarkAnchor?: string;
  priceCorridorBand?: string;
  recommendedPricingBand?: string;
  priceReferencingRisk?: string;
  opportunityKind?: string;
  tenderOpportunity?: boolean;
  tenderSignalStrength?: string;
  annualOpportunityRange?: string;
  estimatedCustomers?: number;
  accessibleShare?: number;
  physicianAdoptionRate?: number;
  accessibleVolumeEstimate?: string;
  publicPrivateMixSummary?: string;
  physicianAdoptionSummary?: string;
  reimbursementConstraintLevel?: string;
  tenderBarrierLevel?: string;
  entryStrategyRecommendation?: string;
  entryStrategyChannel?: string;
  entryStrategySequencing?: string;
  marketAccessRoute?: string;
  notes?: string;
}

interface CountryCellEditorProps {
  open: boolean;
  onClose: () => void;
  opportunity: CountryOpportunity;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function CountryCellEditor({
  open,
  onClose,
  opportunity,
}: CountryCellEditorProps) {
  const [score, setScore] = useState(String(opportunity.opportunityScore ?? ""));
  const [regulatoryStatus, setRegulatoryStatus] = useState(
    opportunity.regulatoryStatus ?? ""
  );
  const [competitorPresence, setCompetitorPresence] = useState(
    opportunity.competitorPresence ?? ""
  );
  const [marketSize, setMarketSize] = useState(opportunity.marketSizeEstimate ?? "");
  const [availabilityStatus, setAvailabilityStatus] = useState(
    opportunity.availabilityStatus ?? ""
  );
  const [treatmentVolumeProxy, setTreatmentVolumeProxy] = useState(
    opportunity.treatmentVolumeProxy ?? ""
  );
  const [priceCorridor, setPriceCorridor] = useState(opportunity.priceCorridor ?? "");
  const [primaryPriceBenchmark, setPrimaryPriceBenchmark] = useState(
    opportunity.primaryPriceBenchmark ?? ""
  );
  const [pricingConfidence, setPricingConfidence] = useState(
    opportunity.pricingConfidence ?? ""
  );
  const [pricePositioning, setPricePositioning] = useState(
    opportunity.pricePositioning ?? ""
  );
  const [competitionIntensity, setCompetitionIntensity] = useState(
    opportunity.competitionIntensity ?? ""
  );
  const [competitivePriceSummary, setCompetitivePriceSummary] = useState(
    opportunity.competitivePriceSummary ?? ""
  );
  const [priceCorridorBand, setPriceCorridorBand] = useState(
    opportunity.priceCorridorBand ?? ""
  );
  const [recommendedPricingBand, setRecommendedPricingBand] = useState(
    opportunity.recommendedPricingBand ?? ""
  );
  const [priceReferencingRisk, setPriceReferencingRisk] = useState(
    opportunity.priceReferencingRisk ?? ""
  );
  const [opportunityKind, setOpportunityKind] = useState(
    opportunity.opportunityKind ?? ""
  );
  const [tenderSignalStrength, setTenderSignalStrength] = useState(
    opportunity.tenderSignalStrength ?? ""
  );
  const [annualOpportunityRange, setAnnualOpportunityRange] = useState(
    opportunity.annualOpportunityRange ?? ""
  );
  const [estimatedCustomers, setEstimatedCustomers] = useState(
    opportunity.estimatedCustomers?.toString() ?? ""
  );
  const [accessibleShare, setAccessibleShare] = useState(
    opportunity.accessibleShare?.toString() ?? ""
  );
  const [physicianAdoptionRate, setPhysicianAdoptionRate] = useState(
    opportunity.physicianAdoptionRate?.toString() ?? ""
  );
  const [accessibleVolumeEstimate, setAccessibleVolumeEstimate] = useState(
    opportunity.accessibleVolumeEstimate ?? ""
  );
  const [publicPrivateMixSummary, setPublicPrivateMixSummary] = useState(
    opportunity.publicPrivateMixSummary ?? ""
  );
  const [physicianAdoptionSummary, setPhysicianAdoptionSummary] = useState(
    opportunity.physicianAdoptionSummary ?? ""
  );
  const [reimbursementConstraintLevel, setReimbursementConstraintLevel] = useState(
    opportunity.reimbursementConstraintLevel ?? ""
  );
  const [tenderBarrierLevel, setTenderBarrierLevel] = useState(
    opportunity.tenderBarrierLevel ?? ""
  );
  const [entryStrategyRecommendation, setEntryStrategyRecommendation] = useState(
    opportunity.entryStrategyRecommendation ?? ""
  );
  const [entryStrategyChannel, setEntryStrategyChannel] = useState(
    opportunity.entryStrategyChannel ?? ""
  );
  const [entryStrategySequencing, setEntryStrategySequencing] = useState(
    opportunity.entryStrategySequencing ?? ""
  );
  const [marketAccessRoute, setMarketAccessRoute] = useState(
    opportunity.marketAccessRoute ?? ""
  );
  const [notes, setNotes] = useState(opportunity.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);
  const [signalSaving, setSignalSaving] = useState(false);

  const [priceSourceCategory, setPriceSourceCategory] = useState("official");
  const [priceSourceSystem, setPriceSourceSystem] = useState("manual");
  const [priceType, setPriceType] = useState("list");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [pricePresentation, setPricePresentation] = useState("");
  const [priceUnitBasis, setPriceUnitBasis] = useState("");
  const [priceObservedAt, setPriceObservedAt] = useState(todayInputValue());
  const [priceSourceTitle, setPriceSourceTitle] = useState("");
  const [priceSourceUrl, setPriceSourceUrl] = useState("");
  const [priceConfidence, setPriceConfidence] = useState("likely");
  const [priceNotes, setPriceNotes] = useState("");

  const [signalType, setSignalType] = useState("tender");
  const [signalSourceCategory, setSignalSourceCategory] = useState("official");
  const [signalSourceSystem, setSignalSourceSystem] = useState("manual");
  const [signalStrength, setSignalStrength] = useState("medium");
  const [signalObservedAt, setSignalObservedAt] = useState(todayInputValue());
  const [signalSummary, setSignalSummary] = useState("");
  const [signalSourceTitle, setSignalSourceTitle] = useState("");
  const [signalSourceUrl, setSignalSourceUrl] = useState("");
  const [signalConfidence, setSignalConfidence] = useState("likely");
  const [signalNotes, setSignalNotes] = useState("");
  const [websiteSaving, setWebsiteSaving] = useState(false);
  const [websiteSourceType, setWebsiteSourceType] = useState("official_registry");
  const [websiteSourceCategory, setWebsiteSourceCategory] = useState("official");
  const [websiteSourceSystem, setWebsiteSourceSystem] = useState("manual");
  const [websiteConfidence, setWebsiteConfidence] = useState("likely");
  const [websiteObservedAt, setWebsiteObservedAt] = useState(todayInputValue());
  const [websiteTitle, setWebsiteTitle] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteClaim, setWebsiteClaim] = useState("");
  const [websiteNotes, setWebsiteNotes] = useState("");

  const upsert = useMutation(api.opportunities.upsert);
  const upsertPriceEvidence = useMutation(api.opportunities.upsertPriceEvidence);
  const deletePriceEvidence = useMutation(api.opportunities.deletePriceEvidence);
  const upsertCommercialSignal = useMutation(api.opportunities.upsertCommercialSignal);
  const deleteCommercialSignal = useMutation(api.opportunities.deleteCommercialSignal);
  const upsertWebsiteEvidence = useMutation(api.opportunities.upsertWebsiteEvidence);
  const deleteWebsiteEvidence = useMutation(api.opportunities.deleteWebsiteEvidence);
  const recomputeCommercialSummary = useMutation(
    api.opportunities.recomputeCommercialSummaryForDrugCountry
  );

  const priceEvidence = useQuery(
    api.opportunities.listPriceEvidence,
    open ? { drugId: opportunity.drugId, country: opportunity.country } : "skip"
  );
  const commercialSignals = useQuery(
    api.opportunities.listCommercialSignals,
    open ? { drugId: opportunity.drugId, country: opportunity.country } : "skip"
  );
  const websiteEvidence = useQuery(
    api.opportunities.listWebsiteEvidenceForDrugCountry,
    open ? { drugId: opportunity.drugId, country: opportunity.country } : "skip"
  );

  const observedPriceCount = priceEvidence?.length ?? 0;
  const observedSignalCount = commercialSignals?.length ?? 0;
  const observedWebsiteEvidenceCount = websiteEvidence?.length ?? 0;
  const tenderSignalCount = useMemo(
    () =>
      (commercialSignals ?? []).filter(
        (signal) => signal.signalType === "tender" || signal.signalType === "procurement"
      ).length,
    [commercialSignals]
  );

  async function handleSave() {
    const scoreNum = score ? Number(score) : undefined;
    if (scoreNum !== undefined && (scoreNum < 1 || scoreNum > 10)) return;
    setLoading(true);
    try {
      await upsert({
        drugId: opportunity.drugId,
        country: opportunity.country,
        opportunityScore: scoreNum,
        regulatoryStatus: regulatoryStatus || undefined,
        competitorPresence: competitorPresence || undefined,
        marketSizeEstimate: marketSize || undefined,
        availabilityStatus: availabilityStatus || undefined,
        treatmentVolumeProxy: treatmentVolumeProxy || undefined,
        priceCorridor: priceCorridor || undefined,
        primaryPriceBenchmark: primaryPriceBenchmark || undefined,
        pricingConfidence: pricingConfidence || undefined,
        pricePositioning: pricePositioning || undefined,
        competitionIntensity: competitionIntensity || undefined,
        competitivePriceSummary: competitivePriceSummary || undefined,
        priceCorridorBand: priceCorridorBand || undefined,
        recommendedPricingBand: recommendedPricingBand || undefined,
        priceReferencingRisk: priceReferencingRisk || undefined,
        opportunityKind: opportunityKind || undefined,
        tenderOpportunity:
          tenderSignalStrength.length > 0 ? tenderSignalStrength !== "none" : undefined,
        tenderSignalStrength: tenderSignalStrength || undefined,
        annualOpportunityRange: annualOpportunityRange || undefined,
        estimatedCustomers: estimatedCustomers ? Number(estimatedCustomers) : undefined,
        accessibleShare: accessibleShare ? Number(accessibleShare) : undefined,
        physicianAdoptionRate: physicianAdoptionRate
          ? Number(physicianAdoptionRate)
          : undefined,
        accessibleVolumeEstimate: accessibleVolumeEstimate || undefined,
        publicPrivateMixSummary: publicPrivateMixSummary || undefined,
        physicianAdoptionSummary: physicianAdoptionSummary || undefined,
        reimbursementConstraintLevel: reimbursementConstraintLevel || undefined,
        tenderBarrierLevel: tenderBarrierLevel || undefined,
        entryStrategyRecommendation: entryStrategyRecommendation || undefined,
        entryStrategyChannel: entryStrategyChannel || undefined,
        entryStrategySequencing: entryStrategySequencing || undefined,
        marketAccessRoute: marketAccessRoute || undefined,
        notes: notes || undefined,
        commercialSummaryMode: "manual",
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPriceEvidence() {
    const amount = Number(priceAmount);
    if (!Number.isFinite(amount) || !priceSourceTitle.trim()) return;
    setPriceSaving(true);
    try {
      await upsertPriceEvidence({
        drugId: opportunity.drugId,
        country: opportunity.country,
        sourceCategory: priceSourceCategory as
          | "official"
          | "commercial_database"
          | "proxy",
        sourceSystem: priceSourceSystem as
          | "cms"
          | "nhsbsa"
          | "sfda"
          | "eda_egypt"
          | "mohap_uae"
          | "bfarm_amice"
          | "who"
          | "nupco"
          | "evaluate"
          | "clarivate"
          | "lauer_taxe"
          | "manual"
          | "other",
        priceType: priceType as
          | "registered"
          | "list"
          | "tariff"
          | "reimbursement"
          | "asp"
          | "tender"
          | "retail"
          | "hospital"
          | "other",
        amount,
        currency: priceCurrency,
        presentation: pricePresentation || undefined,
        unitBasis: priceUnitBasis || undefined,
        observedAt: new Date(priceObservedAt).getTime(),
        sourceTitle: priceSourceTitle,
        sourceUrl: priceSourceUrl || undefined,
        confidence: priceConfidence as "confirmed" | "likely" | "inferred",
        notes: priceNotes || undefined,
      });
      setPriceAmount("");
      setPricePresentation("");
      setPriceUnitBasis("");
      setPriceSourceTitle("");
      setPriceSourceUrl("");
      setPriceNotes("");
    } finally {
      setPriceSaving(false);
    }
  }

  async function handleAddSignal() {
    if (!signalSummary.trim() || !signalSourceTitle.trim()) return;
    setSignalSaving(true);
    try {
      await upsertCommercialSignal({
        drugId: opportunity.drugId,
        country: opportunity.country,
        signalType: signalType as
          | "tender"
          | "procurement"
          | "reimbursement"
          | "tariff"
          | "channel"
          | "competition"
          | "proxy",
        sourceCategory: signalSourceCategory as
          | "official"
          | "commercial_database"
          | "proxy",
        sourceSystem: signalSourceSystem as
          | "cms"
          | "nhsbsa"
          | "sfda"
          | "eda_egypt"
          | "mohap_uae"
          | "bfarm_amice"
          | "who"
          | "nupco"
          | "evaluate"
          | "clarivate"
          | "lauer_taxe"
          | "manual"
          | "other",
        summary: signalSummary,
        signalStrength: signalStrength as "high" | "medium" | "low",
        sourceTitle: signalSourceTitle,
        sourceUrl: signalSourceUrl || undefined,
        observedAt: new Date(signalObservedAt).getTime(),
        confidence: signalConfidence as "confirmed" | "likely" | "inferred",
        notes: signalNotes || undefined,
      });
      setSignalSummary("");
      setSignalSourceTitle("");
      setSignalSourceUrl("");
      setSignalNotes("");
    } finally {
      setSignalSaving(false);
    }
  }

  async function handleAddWebsiteEvidence() {
    if (!websiteClaim.trim() || !websiteTitle.trim() || !websiteUrl.trim()) return;
    setWebsiteSaving(true);
    try {
      await upsertWebsiteEvidence({
        drugId: opportunity.drugId,
        country: opportunity.country,
        claim: websiteClaim,
        title: websiteTitle,
        url: websiteUrl,
        sourceType: websiteSourceType as
          | "official_registry"
          | "shortage_list"
          | "tender_portal"
          | "public_procurement"
          | "essential_medicines"
          | "market_report"
          | "company"
          | "internal",
        sourceSystem: websiteSourceSystem as
          | "cms"
          | "nhsbsa"
          | "sfda"
          | "eda_egypt"
          | "mohap_uae"
          | "bfarm_amice"
          | "who"
          | "nupco"
          | "evaluate"
          | "clarivate"
          | "lauer_taxe"
          | "manual"
          | "other",
        sourceCategory: websiteSourceCategory as
          | "official"
          | "commercial_database"
          | "proxy",
        confidence: websiteConfidence as "confirmed" | "likely" | "inferred",
        observedAt: websiteObservedAt ? new Date(websiteObservedAt).getTime() : undefined,
        notes: websiteNotes || undefined,
      });
      setWebsiteTitle("");
      setWebsiteUrl("");
      setWebsiteClaim("");
      setWebsiteNotes("");
    } finally {
      setWebsiteSaving(false);
    }
  }

  async function handleResetAutoSummary() {
    setLoading(true);
    try {
      await upsert({
        drugId: opportunity.drugId,
        country: opportunity.country,
        commercialSummaryMode: "auto",
      });
      await recomputeCommercialSummary({
        drugId: opportunity.drugId,
        country: opportunity.country,
        force: true,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl bg-zinc-900 border-zinc-800 text-white max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {opportunity.country} commercial intelligence
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-2">
          <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
                <span>{observedPriceCount} price record{observedPriceCount === 1 ? "" : "s"}</span>
                <span>{observedSignalCount} commercial signal{observedSignalCount === 1 ? "" : "s"}</span>
                <span>{observedWebsiteEvidenceCount} website reference{observedWebsiteEvidenceCount === 1 ? "" : "s"}</span>
                <span>{tenderSignalCount} tender/procurement signal{tenderSignalCount === 1 ? "" : "s"}</span>
              </div>
              <Link
                href={`/drugs/${opportunity.drugId}/markets/${encodeURIComponent(opportunity.country)}`}
                className="inline-flex items-center rounded-lg border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] px-3 py-2 text-sm text-[var(--brand-300)] transition-colors hover:border-[color:var(--brand-500)] hover:text-white"
              >
                Open margin simulator
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryBox label="EU reference" value={opportunity.euReferenceAnchor ?? "Not set"} />
              <SummaryBox label="GCC registered" value={opportunity.gccRegisteredAnchor ?? "Not set"} />
              <SummaryBox label="Tender benchmark" value={opportunity.tenderBenchmarkAnchor ?? "Not set"} />
              <SummaryBox label="Recommended band" value={recommendedPricingBand || opportunity.recommendedPricingBand || "Not derived yet"} />
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="min-w-0 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">
                  Opportunity Score <span className="text-zinc-600">(1–10)</span>
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="e.g. 7"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Regulatory Status"
                  value={regulatoryStatus}
                  onValueChange={setRegulatoryStatus}
                  options={REGULATORY_STATUS_OPTIONS}
                />
                <SelectField
                  label="Competitor Presence"
                  value={competitorPresence}
                  onValueChange={setCompetitorPresence}
                  options={COMPETITOR_PRESENCE_OPTIONS}
                />
                <SelectField
                  label="Availability State"
                  value={availabilityStatus}
                  onValueChange={setAvailabilityStatus}
                  options={AVAILABILITY_STATUS_OPTIONS}
                />
                <SelectField
                  label="Access Route"
                  value={marketAccessRoute}
                  onValueChange={setMarketAccessRoute}
                  options={MARKET_ACCESS_ROUTE_OPTIONS}
                />
                <SelectField
                  label="Opportunity Type"
                  value={opportunityKind}
                  onValueChange={setOpportunityKind}
                  options={COMMERCIAL_OPPORTUNITY_KIND_OPTIONS}
                />
                <SelectField
                  label="Pricing Confidence"
                  value={pricingConfidence}
                  onValueChange={setPricingConfidence}
                  options={PRICING_CONFIDENCE_OPTIONS}
                />
                <SelectField
                  label="Price Positioning"
                  value={pricePositioning}
                  onValueChange={setPricePositioning}
                  options={PRICE_POSITIONING_OPTIONS}
                />
                <SelectField
                  label="Competition Intensity"
                  value={competitionIntensity}
                  onValueChange={setCompetitionIntensity}
                  options={COMPETITION_INTENSITY_OPTIONS}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Market Size Estimate"
                  value={marketSize}
                  onChange={setMarketSize}
                  placeholder="e.g. $50M annually"
                />
                <Field
                  label="Treatment Volume Proxy"
                  value={treatmentVolumeProxy}
                  onChange={setTreatmentVolumeProxy}
                  placeholder="e.g. 14k addressable patients"
                />
                <Field
                  label="Price Corridor"
                  value={priceCorridor}
                  onChange={setPriceCorridor}
                  placeholder="e.g. SAR 900–1,200 / month"
                />
                <Field
                  label="Three-Anchor Corridor"
                  value={priceCorridorBand}
                  onChange={setPriceCorridorBand}
                  placeholder="e.g. EUR 420 - SAR 2,150 anchor band"
                />
                <Field
                  label="Primary Price Benchmark"
                  value={primaryPriceBenchmark}
                  onChange={setPrimaryPriceBenchmark}
                  placeholder="e.g. SAR 1,050 · reimbursement · official"
                />
                <Field
                  label="Recommended Pricing Band"
                  value={recommendedPricingBand}
                  onChange={setRecommendedPricingBand}
                  placeholder="e.g. stay near GCC midpoint, bias low for tender"
                />
                <Field
                  label="Tender Signal Strength"
                  value={tenderSignalStrength}
                  onChange={setTenderSignalStrength}
                  placeholder="e.g. medium"
                />
                <Field
                  label="Annual Opportunity Range"
                  value={annualOpportunityRange}
                  onChange={setAnnualOpportunityRange}
                  placeholder="e.g. $8M–12M annual opportunity"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Estimated Customers"
                  value={estimatedCustomers}
                  onChange={setEstimatedCustomers}
                  placeholder="e.g. 1200"
                />
                <Field
                  label="Accessible Share"
                  value={accessibleShare}
                  onChange={setAccessibleShare}
                  placeholder="e.g. 0.35"
                />
                <Field
                  label="Physician Adoption Rate"
                  value={physicianAdoptionRate}
                  onChange={setPhysicianAdoptionRate}
                  placeholder="e.g. 0.25"
                />
                <SelectField
                  label="Price Referencing Risk"
                  value={priceReferencingRisk}
                  onValueChange={setPriceReferencingRisk}
                  options={MARKET_MODEL_LEVEL_OPTIONS}
                />
                <SelectField
                  label="Reimbursement Constraint"
                  value={reimbursementConstraintLevel}
                  onValueChange={setReimbursementConstraintLevel}
                  options={MARKET_MODEL_LEVEL_OPTIONS}
                />
                <SelectField
                  label="Tender Barrier Level"
                  value={tenderBarrierLevel}
                  onValueChange={setTenderBarrierLevel}
                  options={MARKET_MODEL_LEVEL_OPTIONS}
                />
                <SelectField
                  label="Entry Strategy Channel"
                  value={entryStrategyChannel}
                  onValueChange={setEntryStrategyChannel}
                  options={ENTRY_STRATEGY_CHANNEL_OPTIONS}
                />
                <SelectField
                  label="Entry Sequencing"
                  value={entryStrategySequencing}
                  onValueChange={setEntryStrategySequencing}
                  options={ENTRY_STRATEGY_SEQUENCING_OPTIONS}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Accessible Volume"
                  value={accessibleVolumeEstimate}
                  onChange={setAccessibleVolumeEstimate}
                  placeholder="e.g. 420 annual units accessible"
                />
                <Field
                  label="Public / Private Mix"
                  value={publicPrivateMixSummary}
                  onChange={setPublicPrivateMixSummary}
                  placeholder="e.g. Public 70% / Private 30%"
                />
                <Field
                  label="Physician Adoption Summary"
                  value={physicianAdoptionSummary}
                  onChange={setPhysicianAdoptionSummary}
                  placeholder="e.g. gradual adoption after KOL seeding"
                />
                <Field
                  label="Entry Strategy Recommendation"
                  value={entryStrategyRecommendation}
                  onChange={setEntryStrategyRecommendation}
                  placeholder="e.g. start private, build evidence, then move into tender"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Competitive Price Summary</label>
                <Textarea
                  value={competitivePriceSummary}
                  onChange={(e) => setCompetitivePriceSummary(e.target.value)}
                  placeholder="Summarize branded/generic price competition and the market's likely price pressure."
                  rows={3}
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Key contacts, pricing assumptions, distributor comments, tender notes..."
                  rows={3}
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h3 className="text-sm font-semibold text-white">Observed price evidence</h3>
                <div className="mt-3 space-y-2">
                  {priceEvidence === undefined ? (
                    <p className="text-sm text-zinc-500">Loading price records…</p>
                  ) : priceEvidence.length === 0 ? (
                    <p className="text-sm text-zinc-500">No price evidence yet.</p>
                  ) : (
                    priceEvidence.map((entry) => (
                      <div
                        key={entry._id}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm text-white">
                              {entry.currency} {entry.amount.toFixed(2)} · {entry.priceType.replaceAll("_", " ")}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {entry.sourceCategory.replaceAll("_", " ")} · {entry.sourceSystem.replaceAll("_", " ")} · {entry.sourceTitle}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-0 text-zinc-500 hover:bg-transparent hover:text-zinc-300"
                            onClick={() => void deletePriceEvidence({ id: entry._id })}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h3 className="text-sm font-semibold text-white">Commercial / tender signals</h3>
                <div className="mt-3 space-y-2">
                  {commercialSignals === undefined ? (
                    <p className="text-sm text-zinc-500">Loading commercial signals…</p>
                  ) : commercialSignals.length === 0 ? (
                    <p className="text-sm text-zinc-500">No commercial signals yet.</p>
                  ) : (
                    commercialSignals.map((entry) => (
                      <div
                        key={entry._id}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm text-white">
                              {entry.signalType.replaceAll("_", " ")} · {entry.signalStrength}
                            </p>
                            <p className="mt-1 text-xs text-zinc-400">{entry.summary}</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {entry.sourceCategory.replaceAll("_", " ")} · {entry.sourceSystem.replaceAll("_", " ")} · {entry.sourceTitle}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-0 text-zinc-500 hover:bg-transparent hover:text-zinc-300"
                            onClick={() => void deleteCommercialSignal({ id: entry._id })}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h3 className="text-sm font-semibold text-white">Website-backed availability evidence</h3>
                <div className="mt-3 space-y-2">
                  {websiteEvidence === undefined ? (
                    <p className="text-sm text-zinc-500">Loading website references…</p>
                  ) : websiteEvidence.length === 0 ? (
                    <p className="text-sm text-zinc-500">No website references yet.</p>
                  ) : (
                    websiteEvidence.map((entry) => (
                      <div
                        key={entry._id}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm text-white">{entry.title}</p>
                            <p className="mt-1 text-xs text-zinc-400">{entry.claim}</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {entry.sourceType.replaceAll("_", " ")} · {entry.sourceCategory.replaceAll("_", " ")} · {entry.sourceSystem.replaceAll("_", " ")}
                            </p>
                            <a
                              href={entry.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-xs text-[var(--brand-300)] hover:text-white"
                            >
                              {entry.url}
                            </a>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-0 text-zinc-500 hover:bg-transparent hover:text-zinc-300"
                            onClick={() => void deleteWebsiteEvidence({ id: entry._id })}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <EvidenceComposer
              title="Add price evidence"
              fields={
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="Source Category"
                      value={priceSourceCategory}
                      onValueChange={setPriceSourceCategory}
                      options={PRICE_SOURCE_CATEGORY_OPTIONS}
                    />
                    <SelectField
                      label="Source System"
                      value={priceSourceSystem}
                      onValueChange={setPriceSourceSystem}
                      options={PRICE_SOURCE_SYSTEM_OPTIONS}
                    />
                    <SelectField
                      label="Price Type"
                      value={priceType}
                      onValueChange={setPriceType}
                      options={PRICE_TYPE_OPTIONS}
                    />
                    <SelectField
                      label="Confidence"
                      value={priceConfidence}
                      onValueChange={setPriceConfidence}
                      options={EVIDENCE_CONFIDENCE_OPTIONS}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Amount"
                      value={priceAmount}
                      onChange={setPriceAmount}
                      placeholder="e.g. 1050"
                    />
                    <Field
                      label="Currency"
                      value={priceCurrency}
                      onChange={setPriceCurrency}
                      placeholder="USD / SAR / EGP"
                    />
                    <Field
                      label="Presentation"
                      value={pricePresentation}
                      onChange={setPricePresentation}
                      placeholder="e.g. 1 vial / 10mg"
                    />
                    <Field
                      label="Unit Basis"
                      value={priceUnitBasis}
                      onChange={setPriceUnitBasis}
                      placeholder="e.g. per pack / per month"
                    />
                    <Field
                      label="Observed Date"
                      value={priceObservedAt}
                      onChange={setPriceObservedAt}
                      placeholder="YYYY-MM-DD"
                      type="date"
                    />
                    <Field
                      label="Source Title"
                      value={priceSourceTitle}
                      onChange={setPriceSourceTitle}
                      placeholder="e.g. SFDA tariff list"
                    />
                  </div>
                  <Field
                    label="Source URL"
                    value={priceSourceUrl}
                    onChange={setPriceSourceUrl}
                    placeholder="https://..."
                  />
                  <div className="space-y-1.5">
                    <label className="text-sm text-zinc-400">Notes</label>
                    <Textarea
                      value={priceNotes}
                      onChange={(e) => setPriceNotes(e.target.value)}
                      rows={2}
                      placeholder="Assumptions, pack conversion notes, reimbursement context..."
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
                    />
                  </div>
                </>
              }
              action={
                <Button size="sm" onClick={() => void handleAddPriceEvidence()} disabled={priceSaving}>
                  {priceSaving ? "Saving..." : "Add price evidence"}
                </Button>
              }
            />

            <EvidenceComposer
              title="Add commercial / tender signal"
              fields={
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="Signal Type"
                      value={signalType}
                      onValueChange={setSignalType}
                      options={COMMERCIAL_SIGNAL_TYPE_OPTIONS}
                    />
                    <SelectField
                      label="Signal Strength"
                      value={signalStrength}
                      onValueChange={setSignalStrength}
                      options={SIGNAL_STRENGTH_OPTIONS}
                    />
                    <SelectField
                      label="Source Category"
                      value={signalSourceCategory}
                      onValueChange={setSignalSourceCategory}
                      options={PRICE_SOURCE_CATEGORY_OPTIONS}
                    />
                    <SelectField
                      label="Source System"
                      value={signalSourceSystem}
                      onValueChange={setSignalSourceSystem}
                      options={PRICE_SOURCE_SYSTEM_OPTIONS}
                    />
                    <SelectField
                      label="Confidence"
                      value={signalConfidence}
                      onValueChange={setSignalConfidence}
                      options={EVIDENCE_CONFIDENCE_OPTIONS}
                    />
                  </div>
                  <Field
                    label="Observed Date"
                    value={signalObservedAt}
                    onChange={setSignalObservedAt}
                    placeholder="YYYY-MM-DD"
                    type="date"
                  />
                  <Field
                    label="Source Title"
                    value={signalSourceTitle}
                    onChange={setSignalSourceTitle}
                    placeholder="e.g. NUPCO tender notice"
                  />
                  <Field
                    label="Source URL"
                    value={signalSourceUrl}
                    onChange={setSignalSourceUrl}
                    placeholder="https://..."
                  />
                  <div className="space-y-1.5">
                    <label className="text-sm text-zinc-400">Summary</label>
                    <Textarea
                      value={signalSummary}
                      onChange={(e) => setSignalSummary(e.target.value)}
                      rows={3}
                      placeholder="Describe the tender pull, reimbursement rule, tariff signal, channel insight, or competition pressure."
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-zinc-400">Notes</label>
                    <Textarea
                      value={signalNotes}
                      onChange={(e) => setSignalNotes(e.target.value)}
                      rows={2}
                      placeholder="Extra context, timing notes, proxy logic..."
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
                    />
                  </div>
                </>
              }
              action={
                <Button size="sm" onClick={() => void handleAddSignal()} disabled={signalSaving}>
                  {signalSaving ? "Saving..." : "Add signal"}
                </Button>
              }
            />

            <EvidenceComposer
              title="Add website reference"
              fields={
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="Source Type"
                      value={websiteSourceType}
                      onValueChange={setWebsiteSourceType}
                      options={WEBSITE_SOURCE_TYPE_OPTIONS}
                    />
                    <SelectField
                      label="Source Category"
                      value={websiteSourceCategory}
                      onValueChange={setWebsiteSourceCategory}
                      options={PRICE_SOURCE_CATEGORY_OPTIONS}
                    />
                    <SelectField
                      label="Source System"
                      value={websiteSourceSystem}
                      onValueChange={setWebsiteSourceSystem}
                      options={PRICE_SOURCE_SYSTEM_OPTIONS}
                    />
                    <SelectField
                      label="Confidence"
                      value={websiteConfidence}
                      onValueChange={setWebsiteConfidence}
                      options={EVIDENCE_CONFIDENCE_OPTIONS}
                    />
                  </div>
                  <Field
                    label="Observed Date"
                    value={websiteObservedAt}
                    onChange={setWebsiteObservedAt}
                    placeholder="YYYY-MM-DD"
                    type="date"
                  />
                  <Field
                    label="Page Title"
                    value={websiteTitle}
                    onChange={setWebsiteTitle}
                    placeholder="e.g. MOHAP registered medicines search"
                  />
                  <Field
                    label="Source URL"
                    value={websiteUrl}
                    onChange={setWebsiteUrl}
                    placeholder="https://..."
                  />
                  <div className="space-y-1.5">
                    <label className="text-sm text-zinc-400">Claim / Summary</label>
                    <Textarea
                      value={websiteClaim}
                      onChange={(e) => setWebsiteClaim(e.target.value)}
                      rows={3}
                      placeholder="Describe what this page proves about availability, registration, absence, or channel access."
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-zinc-400">Notes</label>
                    <Textarea
                      value={websiteNotes}
                      onChange={(e) => setWebsiteNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional context, caveats, translation notes..."
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
                    />
                  </div>
                </>
              }
              action={
                <Button
                  size="sm"
                  onClick={() => void handleAddWebsiteEvidence()}
                  disabled={websiteSaving}
                >
                  {websiteSaving ? "Saving..." : "Add website reference"}
                </Button>
              }
            />
          </section>

          <div className="flex justify-between gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleResetAutoSummary()}
              className="border-zinc-700 hover:bg-zinc-800"
            >
              Reset to auto summary
            </Button>
            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={loading}>
                {loading ? "Saving..." : "Save commercial view"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SelectField({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-zinc-400">{label}</label>
      <Select value={value} onValueChange={(v) => onValueChange(v ?? "")}>
        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent className="bg-zinc-800 border-zinc-700">
          <SelectItem value="" className="text-zinc-400 hover:bg-zinc-700">
            None
          </SelectItem>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="text-white hover:bg-zinc-700"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-zinc-400">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
      />
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-sm text-zinc-200">{value}</p>
    </div>
  );
}

function EvidenceComposer({
  title,
  fields,
  action,
}: {
  title: string;
  fields: ReactNode;
  action: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-4 space-y-4">{fields}</div>
      <div className="mt-4 flex justify-end">{action}</div>
    </section>
  );
}
