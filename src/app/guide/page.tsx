import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, FileSearch, ListChecks, MessageSquare, RefreshCw } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `How To Use KEMEDICA | ${BRAND_NAME}` };

const workflow = [
  {
    icon: RefreshCw,
    title: "1. Refresh the Signal Inbox",
    body: "Open Leads and run the evidence scan. It checks the configured Saudi, UAE, and Egypt official sources, records what it found, and leaves the queue empty when no pursuit clears the evidence gate.",
  },
  {
    icon: FileSearch,
    title: "2. Research missing proof",
    body: "Open the relevant Product or Company and run research. It returns a short inbox of source-backed claims instead of changing the profile by itself.",
  },
  {
    icon: ListChecks,
    title: "3. Approve only what you trust",
    body: "Review each claim, its source, excerpt, and retrieval date. Approving ownership, registration, or a contact updates only that one fact and then rechecks affected leads.",
  },
  {
    icon: MessageSquare,
    title: "4. Record the next move",
    body: "Once a qualified lead appears, open its evidence packet, choose the outreach route, and record each email, call, or reply in Outreach.",
  },
] as const;

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="border-b border-zinc-800 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-300)]">KEMEDICA Guide</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">How to turn evidence into outreach</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
          KEMEDICA helps you choose the next supplier conversation worth having. It separates research from proof: research collects cited claims, a person approves the facts, and only then can a lead enter the queue.
        </p>
      </header>

      <section className="py-8" aria-labelledby="weekly-workflow">
        <h2 id="weekly-workflow" className="text-sm font-semibold uppercase tracking-wider text-white">Your weekly workflow</h2>
        <div className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800">
          {workflow.map((step) => (
            <div key={step.title} className="grid gap-4 py-5 sm:grid-cols-[2rem_minmax(0,1fr)]">
              <step.icon className="h-5 w-5 text-[var(--brand-300)]" />
              <div>
                <h3 className="text-base font-semibold text-white">{step.title}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
        <Link href="/leads" className="mt-6 inline-flex items-center gap-2 bg-[color:var(--brand-500)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[color:var(--brand-600)]">
          Open lead queue <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="grid gap-8 border-t border-zinc-800 py-8 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">What makes a real lead</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />A current official Saudi, UAE, or Egyptian market signal.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />One exact product match and confirmed manufacturer or MAH ownership.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />No confirmed local partner that contradicts the outreach case.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />A named business-development, licensing, commercial, or executive contact with a public email or direct LinkedIn profile.</li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">When the queue is empty</h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            An empty queue is not a failure. It means a product is missing, ownership is unconfirmed, a source is stale, a local partner conflicts with the thesis, or no current public contact route is available. Do not fill it with guesses. Research the Product or Company, review the findings, then run the next scan.
          </p>
          <Link href="/companies" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-300)] hover:text-white">
            <Building2 className="h-4 w-4" /> Open companies
          </Link>
        </div>
      </section>

      <section className="border-t border-zinc-800 py-8" aria-labelledby="research-method">
        <h2 id="research-method" className="text-sm font-semibold uppercase tracking-wider text-white">How research works</h2>
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-base font-semibold text-white">Start with the record that has a gap</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Product research checks identity, manufacturer or MAH, Saudi/UAE/Egypt registration context, current shortage or tender context, conflicting local partners, and public commercial contacts for a verified owner. Company research checks portfolio, company role, local presence or partners, and named BD, licensing, export, or commercial contacts.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/drugs" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-300)] hover:text-white">Open Products <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/companies" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-300)] hover:text-white">Open Companies <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Every finding is a review item</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Each item shows the claim, source link, excerpt, confidence, and retrieval date. Research never quietly edits a product, company, contact, or lead. Rejecting a claim keeps it out; failures remain visible on the run and do not erase previously approved evidence.
            </p>
          </div>
        </div>
        <div className="mt-8 grid gap-8 border-t border-zinc-800 pt-6 lg:grid-cols-2">
          <div>
            <h3 className="text-base font-semibold text-white">Source hierarchy and AI&apos;s role</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Official Saudi and Egyptian regulator and procurement sources come first. UAE registration status is accepted only from the authorized MoHAP import workflow; Egyptian registration claims need an authorized record because the public EDA search is access-controlled. Company sites, press releases, conference listings, public work emails, and direct LinkedIn profiles can support ownership and contacts. General public pages provide context, never a shortcut around missing official proof.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              AI can search, extract, classify, and summarize the sources it returns. It cannot invent a source, infer a missing registration, or publish a lead. A web-research registration claim for the UAE is discarded; the authorized import is the record of truth.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Two common approvals</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              <strong className="font-semibold text-zinc-200">Ownership:</strong> approve a manufacturer or MAH claim only when the cited page identifies both the product and the company. This confirms that relationship and triggers a lead recheck.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              <strong className="font-semibold text-zinc-200">Public contact:</strong> approve a person only when their name, relevant commercial role, and a current work email or direct LinkedIn profile are shown with a source. It becomes a contact record, not an automatic email.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-800 py-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Where everything lives</h2>
        <dl className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800 text-sm">
          <div className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]"><dt className="font-semibold text-white">Leads</dt><dd className="text-zinc-400">The active queue. Start here when deciding who to approach.</dd></div>
          <div className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]"><dt className="font-semibold text-white">Products</dt><dd className="text-zinc-400">Product identity, ownership, registrations, and current market context. Run product research when a pursuit is missing proof.</dd></div>
          <div className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]"><dt className="font-semibold text-white">Companies</dt><dd className="text-zinc-400">Supplier role, market presence, and public contacts. Run company research when ownership or outreach ownership needs confirmation.</dd></div>
          <div className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]"><dt className="font-semibold text-white">Outreach</dt><dd className="text-zinc-400">The follow-up workspace for notes and commercial progress.</dd></div>
          <div className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]"><dt className="font-semibold text-white">Historical research</dt><dd className="text-zinc-400">Older scoring, reports, imports, and research remain available for context but do not create leads on their own.</dd></div>
        </dl>
      </section>
    </main>
  );
}
