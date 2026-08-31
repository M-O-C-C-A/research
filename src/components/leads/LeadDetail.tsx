"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ArrowLeft, ExternalLink, FileText, Linkedin, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeExternalUrl } from "@/lib/urlUtils";

const STAGES = ["new", "working", "contacted", "replied", "won", "lost", "expired", "disqualified"] as const;

function formatDate(value?: number) {
  if (!value) return "Not specified";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

export function LeadDetail({ leadId }: { leadId: string }) {
  const detail = useQuery(api.actionableLeads.get, { id: leadId as Id<"actionableLeads"> });
  const activities = useQuery(
    api.bdActivities.listByLead,
    detail ? { actionableLeadId: detail.lead._id, limit: 20 } : "skip"
  );
  const updateStage = useMutation(api.actionableLeads.updateStage);
  const addActivity = useMutation(api.bdActivities.create);
  const [note, setNote] = useState("");

  if (detail === undefined) {
    return <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"><div className="h-72 animate-pulse border border-zinc-800 bg-zinc-900" /></main>;
  }
  if (!detail || !detail.signal || !detail.contact || !detail.company || !detail.drug) {
    return <main className="mx-auto max-w-6xl px-4 py-10 text-zinc-400 sm:px-6 lg:px-8">This lead is no longer available.</main>;
  }

  const { lead, signal, snapshot, contact, company, drug } = detail;
  const signalUrl = normalizeExternalUrl(signal.sourceUrl);
  const contactUrl = normalizeExternalUrl(contact.linkedinUrl);

  async function saveNote() {
    if (!note.trim()) return;
    await addActivity({ companyId: company._id, actionableLeadId: lead._id, type: "note", content: note.trim() });
    setNote("");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Lead queue</Link>
      <header className="mt-6 border-b border-zinc-800 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-300)]">Actionable Lead</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{lead.productName} · {lead.country}</h1>
            <p className="mt-2 text-sm text-zinc-400">{company.name} · {drug.genericName}</p>
          </div>
          <Select value={lead.stage} onValueChange={(value) => void updateStage({ id: lead._id, stage: value as typeof lead.stage })}>
            <SelectTrigger className="w-40 border-zinc-700 bg-zinc-900 text-zinc-200 capitalize"><SelectValue /></SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-200">
              {STAGES.map((stage) => <SelectItem key={stage} value={stage} className="capitalize">{stage}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </header>

      <section className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <div className="space-y-6">
          <section className="border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300" /><h2 className="text-sm font-semibold uppercase tracking-wider text-white">Qualification</h2></div>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
              {lead.qualificationReasons.map((reason) => <li key={reason} className="flex gap-2"><span className="text-emerald-300">✓</span><span>{reason}</span></li>)}
            </ul>
          </section>

          <section className="border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><h2 className="text-sm font-semibold uppercase tracking-wider text-white">Market evidence</h2><p className="mt-1 text-sm text-zinc-400">{signal.title}</p></div>
              {signalUrl && <a href={signalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--brand-300)] hover:text-white">Open official source <ExternalLink className="h-4 w-4" /></a>}
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <div><dt className="text-xs uppercase tracking-wider text-zinc-500">Signal</dt><dd className="mt-1 text-sm capitalize text-zinc-200">{signal.signalType.replaceAll("_", " ")}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-zinc-500">Observed</dt><dd className="mt-1 text-sm text-zinc-200">{formatDate(signal.observedAt)}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-zinc-500">Deadline</dt><dd className="mt-1 text-sm text-zinc-200">{formatDate(signal.deadline)}</dd></div>
            </dl>
            {Object.keys(signal.parsedFacts).length > 0 && <dl className="mt-5 grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-2">{Object.entries(signal.parsedFacts).map(([key, value]) => <div key={key}><dt className="text-xs capitalize text-zinc-500">{key.replace(/([A-Z])/g, " $1")}</dt><dd className="mt-1 text-sm text-zinc-300">{String(value) || "Not recorded"}</dd></div>)}</dl>}
          </section>

          <section className="border border-zinc-800 bg-zinc-900/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Outreach record</h2>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note" className="mt-4 min-h-24 w-full border border-zinc-700 bg-zinc-950 p-3 text-sm text-white outline-none focus:border-[var(--brand-400)]" />
            <div className="mt-3 flex justify-end"><Button onClick={() => void saveNote()} disabled={!note.trim()}>Add note</Button></div>
            <div className="mt-5 space-y-3 border-t border-zinc-800 pt-4">
              {activities === undefined ? <p className="text-sm text-zinc-500">Loading notes…</p> : activities.length === 0 ? <p className="text-sm text-zinc-500">No outreach activity recorded.</p> : activities.map((activity) => <article key={activity._id} className="border-l-2 border-zinc-700 pl-3"><p className="text-sm text-zinc-200">{activity.content}</p><p className="mt-1 text-xs text-zinc-500">{formatDate(activity.createdAt)} · {activity.type.replaceAll("_", " ")}</p></article>)}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="border border-zinc-800 bg-zinc-900/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Approach</h2>
            <Link href={`/companies/${company._id}`} className="mt-4 block text-lg font-semibold text-white hover:text-[var(--brand-300)]">{company.name}</Link>
            <p className="mt-1 text-sm text-zinc-500">Confirmed product owner</p>
            <div className="mt-5 border-t border-zinc-800 pt-4"><p className="text-sm font-medium text-zinc-200">{contact.name}</p><p className="mt-1 text-sm text-zinc-500">{contact.title}</p>
              <div className="mt-4 space-y-2 text-sm">{contact.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-[var(--brand-300)] hover:text-white"><Mail className="h-4 w-4" />{contact.email}</a>}{contactUrl && <a href={contactUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[var(--brand-300)] hover:text-white"><Linkedin className="h-4 w-4" />Open LinkedIn</a>}</div>
            </div>
          </section>

          <details className="border border-zinc-800 bg-zinc-900/60 p-5">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-200"><FileText className="h-4 w-4" /> Source capture</summary>
            <p className="mt-4 text-xs text-zinc-500">Fetched {snapshot ? formatDate(snapshot.fetchedAt) : "unknown"} · parser {snapshot?.parserVersion ?? "unknown"}</p>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-400">{snapshot?.rawContent ?? "No raw capture available."}</pre>
          </details>
        </aside>
      </section>
    </main>
  );
}
