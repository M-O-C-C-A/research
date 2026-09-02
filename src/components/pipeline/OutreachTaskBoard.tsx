"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock3, Mail, Phone, Linkedin } from "lucide-react";

const icons = { email: Mail, call: Phone, linkedin: Linkedin };

export function OutreachTaskBoard() {
  const rows = useQuery(api.evidenceFunnel.myTasks, {});
  const companyRollups = useQuery(api.evidenceFunnel.companyRollups);
  const currentMember = useQuery(api.workspaceMembers.current);
  const complete = useMutation(api.evidenceFunnel.completeTask);
  const logActivity = useMutation(api.evidenceFunnel.logActivity);
  const acceptAssignment = useMutation(api.evidenceFunnel.acceptAssignment);

  async function completeAndLog(row: NonNullable<typeof rows>[number]) {
    const task = row.task;
    await complete({ taskId: task._id, status: "completed" });
    if (task.channel === "email" || task.channel === "call") {
      await logActivity({
        opportunityId: task.decisionOpportunityId,
        type: task.channel === "email" ? "email_sent" : "call",
        content: `Completed day ${task.sequenceDay} ${task.channel} follow-up: ${task.title}`,
      });
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-300)]">Human-led outreach</p><h1 className="mt-2 text-3xl font-semibold text-white">Today’s commercial work</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">Prepared tasks only. Complete a task after the email, LinkedIn message, or call happened outside KEMEDICA; the action is then recorded against the product opportunity.</p></div>
      {!rows ? <p className="py-12 text-center text-sm text-zinc-500">Loading tasks…</p> : rows.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center text-sm text-zinc-500">No pending outreach tasks. Assign a contact-ready opportunity to create the 0/3/7/14/30 sequence.</div> : rows.map((row) => {
        const Icon = icons[row.task.channel];
        const overdue = row.overdue;
        return <article key={row.task._id} className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5"><div className={`rounded-lg p-3 ${overdue ? "bg-amber-500/10 text-amber-300" : "bg-zinc-950 text-[var(--brand-300)]"}`}><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-white">{row.task.title}</h2><span className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400">Day {row.task.sequenceDay}</span></div><p className="mt-1 text-sm text-zinc-400">{row.opportunity?.productName} · {row.opportunity?.approachEntityName}</p><p className={`mt-1 flex items-center gap-1 text-xs ${overdue ? "text-amber-300" : "text-zinc-500"}`}><Clock3 className="h-3.5 w-3.5" />Due {new Date(row.task.dueAt).toLocaleDateString()} · {row.assignee?.name ?? row.assignee?.email}</p></div>{currentMember?.memberId === row.task.assignedMemberId && !row.opportunity?.assignmentAcceptedAt && <Button variant="outline" onClick={() => void acceptAssignment({ opportunityId: row.task.decisionOpportunityId })}>Accept assignment</Button>}<Button onClick={() => void completeAndLog(row)}><CheckCircle2 className="h-4 w-4" />Mark done</Button></article>;
      })}
      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-lg font-semibold text-white">Company roll-up</h2><p className="mt-1 text-xs text-zinc-500">Derived from product opportunities; legacy company status is not used as commercial truth.</p><div className="mt-4 divide-y divide-zinc-800">{companyRollups?.slice(0, 30).map((row) => <div key={row.company?._id ?? row.topOpportunity?._id} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_10rem_8rem]"><span className="font-medium text-white">{row.company?.name ?? row.topOpportunity?.approachEntityName}</span><span className="text-zinc-400">{row.stage.replaceAll("_", " ")}</span><span className="text-zinc-500">{row.opportunityCount} products</span></div>)}</div></div>
    </section>
  );
}
