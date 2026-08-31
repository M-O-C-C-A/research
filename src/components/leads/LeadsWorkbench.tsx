"use client";

import Link from "next/link";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  ArrowUpRight,
  ExternalLink,
  Linkedin,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { normalizeExternalUrl } from "@/lib/urlUtils";
import { SignalInbox } from "@/components/leads/SignalInbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ACTIVE_STAGE_OPTIONS = [
  { value: "all", label: "All active" },
  { value: "new", label: "New" },
  { value: "working", label: "Working" },
  { value: "contacted", label: "Contacted" },
  { value: "replied", label: "Replied" },
] as const;

const LEAD_STAGES = [
  "new",
  "working",
  "contacted",
  "replied",
  "won",
  "lost",
  "disqualified",
] as const;

function formatDate(value?: number) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value)
  );
}

function formatScanTime(value?: number) {
  if (!value) return "not yet completed";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function stageClass(stage: string) {
  if (stage === "new") return "text-sky-200 bg-sky-400/10 border-sky-400/20";
  if (stage === "working") return "text-amber-200 bg-amber-400/10 border-amber-400/20";
  if (stage === "contacted" || stage === "replied") return "text-emerald-200 bg-emerald-400/10 border-emerald-400/20";
  return "text-zinc-300 bg-zinc-800 border-zinc-700";
}

export function LeadsWorkbench() {
  const [stage, setStage] = useState<(typeof ACTIVE_STAGE_OPTIONS)[number]["value"]>("all");
  const [running, setRunning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const leads = useQuery(api.actionableLeads.list, {
    ...(stage === "all" ? {} : { stage }),
    limit: 100,
  });
  const stats = useQuery(api.actionableLeads.stats, {});
  const inboxStats = useQuery(api.actionableLeads.inboxStats, {});
  const latestScan = useQuery(api.actionableLeads.latestScan, {});
  const runWeekly = useAction(api.leadScans.runWeekly);
  const updateStage = useMutation(api.actionableLeads.updateStage);

  async function runScan() {
    setRunning(true);
    setScanMessage(null);
    try {
      const result = await runWeekly({});
      setScanMessage(
        `${result.signalsFound} official records checked, ${result.leadsPublished} lead${result.leadsPublished === 1 ? "" : "s"} qualified.`
      );
    } catch {
      setScanMessage("The scan could not complete. Existing leads were left unchanged.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-300)]">Lead Queue</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Work only sourced supplier leads</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            The queue holds only qualified outreach work. The Signal Inbox shows only fresh shortage, tender, and procurement signals with the exact verification work still needed.
          </p>
        </div>
        <Button onClick={runScan} disabled={running} className="gap-2 bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)]">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Run evidence scan
        </Button>
      </div>

      {scanMessage && (
        <p role="status" className="mb-4 text-sm text-zinc-400">{scanMessage}</p>
      )}

      <Tabs defaultValue="queue">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <TabsList className="border border-zinc-800 bg-zinc-900">
            <TabsTrigger value="queue" className="px-3 text-zinc-400">Lead queue ({stats?.active ?? 0})</TabsTrigger>
            <TabsTrigger value="inbox" className="px-3 text-zinc-400">Signal inbox ({inboxStats?.currentOutreachSignals ?? 0})</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-4 text-zinc-400">
            <span><strong className="font-semibold text-white">{stats?.new ?? 0}</strong> new</span>
            <span><strong className="font-semibold text-white">{stats?.working ?? 0}</strong> working</span>
            <span><strong className="font-semibold text-white">{stats?.contacted ?? 0}</strong> contacted</span>
          </div>
        </div>

        <TabsContent value="queue">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-zinc-500">{inboxStats?.currentOutreachSignals ?? 0} current outreach signals are being worked in the inbox.</p>
          <Select value={stage} onValueChange={(value) => setStage(value as typeof stage)}>
            <SelectTrigger className="w-36 border-zinc-700 bg-zinc-900 text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-200">
              {ACTIVE_STAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {leads !== undefined && leads.length === 0 ? (
          <div className="border border-dashed border-zinc-800 bg-zinc-950 px-5 py-16 text-center text-sm leading-relaxed text-zinc-500">
            No lead clears the evidence gate yet. The Signal Inbox contains only fresh shortage, tender, and procurement signals; resolve their product, ownership, or contact evidence when present.
          </div>
        ) : (
        <div className="overflow-x-auto border border-zinc-800 bg-zinc-950">
        <Table className="min-w-[1000px]">
          <TableHeader className="bg-zinc-900/80">
            <TableRow className="border-zinc-800 hover:bg-zinc-900/80">
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Pursuit</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Market proof</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Supplier / owner</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Contact</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Deadline</TableHead>
              <TableHead className="pr-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Stage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads === undefined ? (
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index} className="border-zinc-800">
                  <TableCell colSpan={6} className="h-16 px-4"><div className="h-3 w-full animate-pulse bg-zinc-900" /></TableCell>
                </TableRow>
              ))
            ) : (
              leads.map((lead) => {
                const sourceUrl = normalizeExternalUrl(lead.sourceUrl);
                return (
                  <TableRow key={lead._id} className="border-zinc-800 hover:bg-zinc-900/60">
                    <TableCell className="px-4 py-3 whitespace-normal">
                      <Link href={`/leads/${lead._id}`} className="group inline-flex items-center gap-1 text-sm font-semibold text-white hover:text-[var(--brand-300)]">
                        {lead.productName}
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                      <p className="mt-1 text-xs text-zinc-500">{lead.genericName} · {lead.country}</p>
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-normal py-3">
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        <div>
                          <p className="line-clamp-2 text-xs leading-relaxed text-zinc-300">{lead.signalTitle}</p>
                          {sourceUrl && (
                            <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--brand-300)] hover:text-white">
                              Official source <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 whitespace-normal">
                      <Link href={`/companies/${lead.companyId}`} className="text-sm text-zinc-200 hover:text-white">{lead.approachEntityName}</Link>
                      <p className="mt-1 text-xs capitalize text-zinc-500">{lead.signalType.replaceAll("_", " ")}</p>
                    </TableCell>
                    <TableCell className="py-3 whitespace-normal">
                      <p className="text-sm text-zinc-200">{lead.contactName}</p>
                      <p className="mt-1 text-xs text-zinc-500">{lead.contactTitle}</p>
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--brand-300)]">
                        {lead.contactRoute === "email" ? <Mail className="h-3 w-3" /> : <Linkedin className="h-3 w-3" />}
                        {lead.contactRoute === "email" ? "Work email" : "LinkedIn"}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-xs text-zinc-400">{formatDate(lead.deadline)}</TableCell>
                    <TableCell className="pr-4 py-3">
                      <Select value={lead.stage} onValueChange={(value) => void updateStage({ id: lead._id, stage: value as typeof lead.stage })}>
                        <SelectTrigger className={`h-8 w-32 border px-2 text-xs capitalize ${stageClass(lead.stage)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-200">
                          {LEAD_STAGES.map((option) => <SelectItem key={option} value={option} className="capitalize">{option}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
        )}
        </TabsContent>
        <TabsContent value="inbox">
          {latestScan && (
            <div className={`mb-4 border px-4 py-3 text-sm ${latestScan.status === "error" ? "border-rose-500/30 bg-rose-500/10 text-rose-100" : latestScan.status === "partial" ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-zinc-800 bg-zinc-950 text-zinc-400"}`}>
              <p><span className="font-medium text-white">Last scan:</span> {latestScan.status} · {formatScanTime(latestScan.completedAt ?? latestScan.startedAt)} · {latestScan.signalsFound} official records captured.</p>
              {(latestScan.errorMessage || latestScan.warnings[0]) && <p className="mt-1 text-xs leading-relaxed opacity-90">{latestScan.errorMessage ?? latestScan.warnings[0]}</p>}
            </div>
          )}
          <SignalInbox />
        </TabsContent>
      </Tabs>
    </main>
  );
}
