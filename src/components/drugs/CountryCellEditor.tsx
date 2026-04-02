"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
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
  COMPETITOR_PRESENCE_OPTIONS,
  MARKET_ACCESS_ROUTE_OPTIONS,
  REGULATORY_STATUS_OPTIONS,
} from "@/lib/constants";

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
  annualOpportunityRange?: string;
  marketAccessRoute?: string;
  notes?: string;
}

interface CountryCellEditorProps {
  open: boolean;
  onClose: () => void;
  opportunity: CountryOpportunity;
}

export function CountryCellEditor({ open, onClose, opportunity }: CountryCellEditorProps) {
  const [score, setScore] = useState(String(opportunity.opportunityScore ?? ""));
  const [regulatoryStatus, setRegulatoryStatus] = useState(opportunity.regulatoryStatus ?? "");
  const [competitorPresence, setCompetitorPresence] = useState(opportunity.competitorPresence ?? "");
  const [marketSize, setMarketSize] = useState(opportunity.marketSizeEstimate ?? "");
  const [availabilityStatus, setAvailabilityStatus] = useState(opportunity.availabilityStatus ?? "");
  const [treatmentVolumeProxy, setTreatmentVolumeProxy] = useState(opportunity.treatmentVolumeProxy ?? "");
  const [priceCorridor, setPriceCorridor] = useState(opportunity.priceCorridor ?? "");
  const [annualOpportunityRange, setAnnualOpportunityRange] = useState(opportunity.annualOpportunityRange ?? "");
  const [marketAccessRoute, setMarketAccessRoute] = useState(opportunity.marketAccessRoute ?? "");
  const [notes, setNotes] = useState(opportunity.notes ?? "");
  const [loading, setLoading] = useState(false);

  const upsert = useMutation(api.opportunities.upsert);

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
        annualOpportunityRange: annualOpportunityRange || undefined,
        marketAccessRoute: marketAccessRoute || undefined,
        notes: notes || undefined,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">{opportunity.country}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
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
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Regulatory Status</label>
              <Select value={regulatoryStatus} onValueChange={(v) => setRegulatoryStatus(v ?? "")}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="" className="text-zinc-400 hover:bg-zinc-700">None</SelectItem>
                  {REGULATORY_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-white hover:bg-zinc-700">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Competitor Presence</label>
              <Select value={competitorPresence} onValueChange={(v) => setCompetitorPresence(v ?? "")}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="" className="text-zinc-400 hover:bg-zinc-700">Unknown</SelectItem>
                  {COMPETITOR_PRESENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-white hover:bg-zinc-700">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Availability State</label>
              <Select value={availabilityStatus} onValueChange={(v) => setAvailabilityStatus(v ?? "")}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="" className="text-zinc-400 hover:bg-zinc-700">Unknown</SelectItem>
                  {AVAILABILITY_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-white hover:bg-zinc-700">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Access Route</label>
              <Select value={marketAccessRoute} onValueChange={(v) => setMarketAccessRoute(v ?? "")}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="" className="text-zinc-400 hover:bg-zinc-700">Unknown</SelectItem>
                  {MARKET_ACCESS_ROUTE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-white hover:bg-zinc-700">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Market Size Estimate</label>
            <Input
              value={marketSize}
              onChange={(e) => setMarketSize(e.target.value)}
              placeholder="e.g. $50M annually"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Treatment Volume Proxy</label>
              <Input
                value={treatmentVolumeProxy}
                onChange={(e) => setTreatmentVolumeProxy(e.target.value)}
                placeholder="e.g. 14k addressable patients"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Price Corridor</label>
              <Input
                value={priceCorridor}
                onChange={(e) => setPriceCorridor(e.target.value)}
                placeholder="e.g. $900–1,200 / month"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Annual Opportunity Range</label>
            <Input
              value={annualOpportunityRange}
              onChange={(e) => setAnnualOpportunityRange(e.target.value)}
              placeholder="e.g. $8M–12M annual opportunity"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key contacts, local distributors, market insights..."
              rows={3}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
