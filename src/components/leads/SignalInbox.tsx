"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ArrowUpRight, Check, ExternalLink, Loader2, SearchCheck, UserRoundPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizeExternalUrl } from "@/lib/urlUtils";

type InboxItem = FunctionReturnType<typeof api.actionableLeads.listSignalInbox>[number];

function formatDate(value?: number) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function SignalRow({ item }: { item: InboxItem }) {
  const [open, setOpen] = useState(false);
  const [selectedDrugId, setSelectedDrugId] = useState<string>(item.selectedDrug?._id ?? "");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(item.ownerCompany?._id ?? "");
  const [ownershipUrl, setOwnershipUrl] = useState(item.resolution?.ownershipEvidenceUrl ?? "");
  const [saving, setSaving] = useState<"match" | "owner" | "irrelevant" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirmProductMatch = useMutation(api.actionableLeads.confirmProductMatch);
  const markNotRelevant = useMutation(api.actionableLeads.markSignalNotRelevant);
  const verifyOwnership = useMutation(api.actionableLeads.verifyManufacturerOwnership);
  const requalifySignal = useAction(api.leadScans.requalifySignal);
  const sourceUrl = normalizeExternalUrl(item.signal.sourceUrl);

  async function confirmMatch() {
    if (!selectedDrugId) return;
    setSaving("match");
    setError(null);
    try {
      await confirmProductMatch({
        signalId: item.signal._id,
        drugId: selectedDrugId as Id<"drugs">,
      });
      await requalifySignal({ signalId: item.signal._id });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The product match could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  async function confirmOwner() {
    if (!selectedCompanyId || !ownershipUrl.trim()) return;
    setSaving("owner");
    setError(null);
    try {
      await verifyOwnership({
        signalId: item.signal._id,
        companyId: selectedCompanyId as Id<"companies">,
        evidenceUrl: ownershipUrl.trim(),
      });
      await requalifySignal({ signalId: item.signal._id });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The ownership evidence could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  async function dismissSignal() {
    setSaving("irrelevant");
    setError(null);
    try {
      await markNotRelevant({ signalId: item.signal._id });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The signal could not be dismissed.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Fragment>
      <TableRow className="border-zinc-800 align-top hover:bg-zinc-900/50">
        <TableCell className="px-4 py-3 whitespace-normal">
          <div className="flex items-start gap-2">
            <SearchCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-300)]" />
            <div>
              <p className="max-w-72 text-sm font-medium leading-snug text-zinc-100">{item.signal.title}</p>
              <p className="mt-1 text-xs text-zinc-500">{item.signal.country} · {item.signal.sourceSystem.replaceAll("_", " ")}</p>
              {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--brand-300)] hover:text-white">Official source <ExternalLink className="h-3 w-3" /></a>}
            </div>
          </div>
        </TableCell>
        <TableCell className="py-3 whitespace-normal">
          {item.selectedDrug ? (
            <Link href={`/drugs/${item.selectedDrug._id}`} className="inline-flex items-center gap-1 text-sm text-zinc-200 hover:text-white">
              {item.selectedDrug.name}<ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : <span className="text-sm text-amber-200">Unresolved</span>}
          {item.selectedDrug && <p className="mt-1 text-xs text-zinc-500">{item.selectedDrug.genericName}</p>}
        </TableCell>
        <TableCell className="py-3 whitespace-normal">
          {item.ownerCompany ? <Link href={`/companies/${item.ownerCompany._id}`} className="text-sm text-zinc-200 hover:text-white">{item.ownerCompany.name}</Link> : <span className="text-sm text-amber-200">Unverified</span>}
        </TableCell>
        <TableCell className="py-3 whitespace-normal">
          {item.contact ? <><p className="text-sm text-zinc-200">{item.contact.name}</p><p className="mt-1 text-xs text-zinc-500">{item.contact.title}</p></> : <span className="text-sm text-amber-200">No current route</span>}
        </TableCell>
        <TableCell className="max-w-64 py-3 whitespace-normal">
          <span className="inline-flex border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">{item.originLabel}</span>
          <p className="mt-2 text-xs capitalize text-zinc-500">{item.readinessStatus.replaceAll("_", " ")}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{item.blockers[0] ?? "All evidence gates passed."}</p>
          {item.blockers.length > 1 && <p className="mt-1 text-xs text-zinc-600">+{item.blockers.length - 1} more</p>}
        </TableCell>
        <TableCell className="pr-4 py-3 whitespace-normal">
          <p className="mb-2 text-xs leading-relaxed text-zinc-400">{item.suggestedAction}</p>
          <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)} className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800">
            {open ? "Close" : "Resolve"}
          </Button>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="border-zinc-800 bg-zinc-950/80 hover:bg-zinc-950/80">
          <TableCell colSpan={6} className="px-4 py-4 whitespace-normal">
            <div className="grid gap-5 lg:grid-cols-3">
              <section>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">1. Product match</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">Choose only a product that the official source explicitly names or clearly identifies.</p>
                <Select value={selectedDrugId} onValueChange={(value) => setSelectedDrugId(value ?? "")}>
                  <SelectTrigger className="mt-3 w-full border-zinc-700 bg-zinc-900 text-zinc-200"><SelectValue placeholder="Choose a product" /></SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-200">
                    {item.candidateDrugs.map((drug) => <SelectItem key={drug._id} value={drug._id}>{drug.name} · {drug.genericName}</SelectItem>)}
                  </SelectContent>
                </Select>
                {item.candidateDrugs.length === 0 && <p className="mt-2 text-xs text-amber-200">No credible product candidate was found. Add or correct the product record before resolving this signal.</p>}
                <Button size="sm" onClick={confirmMatch} disabled={!selectedDrugId || saving !== null} className="mt-3 gap-1.5 bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)]">
                  {saving === "match" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Confirm match
                </Button>
              </section>
              <section>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">2. Ownership proof</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">Link a public manufacturer or MAH page. This does not alter the product graph; it records the evidence for this pursuit.</p>
                <Select value={selectedCompanyId} onValueChange={(value) => setSelectedCompanyId(value ?? "")} disabled={!item.selectedDrug}>
                  <SelectTrigger className="mt-3 w-full border-zinc-700 bg-zinc-900 text-zinc-200"><SelectValue placeholder="Choose linked owner" /></SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-200">
                    {item.ownershipCandidates.map((company) => <SelectItem key={company._id} value={company._id}>{company.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={ownershipUrl} onChange={(event) => setOwnershipUrl(event.target.value)} placeholder="https://public-owner-source.example" disabled={!item.selectedDrug} className="mt-2 border-zinc-700 bg-zinc-900 text-zinc-200 placeholder:text-zinc-600" />
                <Button size="sm" variant="outline" onClick={confirmOwner} disabled={!selectedCompanyId || !ownershipUrl.trim() || saving !== null} className="mt-3 gap-1.5 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800">
                  {saving === "owner" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Verify owner
                </Button>
              </section>
              <section>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">3. Contact route</p>
                {item.ownerCompany ? (
                  <>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">Record a named BD, licensing, export, commercial, or executive contact with a public work route.</p>
                    <Link href={`/companies/${item.ownerCompany._id}`} className="mt-3 inline-flex h-8 items-center gap-1.5 border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-800"><UserRoundPlus className="h-3.5 w-3.5" /> Add public contact</Link>
                  </>
                ) : <p className="mt-1 text-xs leading-relaxed text-zinc-500">Confirm the product and ownership first. The contact must belong to the verified approach company.</p>}
                <div className="mt-5 border-t border-zinc-800 pt-3">
                  <p className="text-xs text-zinc-600">Deadline: {formatDate(item.signal.deadline)}</p>
                  <Button size="sm" variant="ghost" onClick={dismissSignal} disabled={saving !== null} className="mt-2 h-7 gap-1 px-0 text-zinc-500 hover:bg-transparent hover:text-zinc-300">
                    {saving === "irrelevant" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Not relevant
                  </Button>
                </div>
              </section>
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

export function SignalInbox() {
  const inbox = useQuery(api.actionableLeads.listSignalInbox, { limit: 100 });

  if (inbox === undefined) {
    return <div className="border border-zinc-800 bg-zinc-950 px-5 py-16 text-center text-sm text-zinc-500">Loading source signals...</div>;
  }

  if (inbox.length === 0) {
    return <div className="border border-dashed border-zinc-800 bg-zinc-950 px-5 py-16 text-center text-sm leading-relaxed text-zinc-500">No fresh shortage, tender, or procurement signal has been captured yet. Registration imports remain evidence only and do not enter this worklist.</div>;
  }

  return (
    <div className="overflow-x-auto border border-zinc-800 bg-zinc-950">
      <Table className="min-w-[1160px]">
        <TableHeader className="bg-zinc-900/80">
          <TableRow className="border-zinc-800 hover:bg-zinc-900/80">
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Official signal</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Product</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Owner / MAH</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Contact</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Gate status</TableHead>
            <TableHead className="pr-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Next work</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{inbox.map((item) => <SignalRow key={item.signal._id} item={item} />)}</TableBody>
      </Table>
    </div>
  );
}
