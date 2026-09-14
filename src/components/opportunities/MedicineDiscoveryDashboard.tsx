"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  Search,
  RefreshCw,
  FlaskConical,
  CheckCircle2,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { CommercialReviewPanel } from "./CommercialReviewPanel";
import {
  commercialSignals,
  shortlistBlockers,
} from "../../../convex/medicineDiscoveryReviewPolicy";
import { Input } from "@/components/ui/input";

type Medicine = Doc<"medicineDiscoveries">;
const countries = ["UAE", "Saudi Arabia", "Egypt"] as const;
function date(value: number | string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function SourceLink({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-sky-300 underline decoration-sky-700 underline-offset-4 hover:text-sky-100"
    >
      {children}
      <ArrowUpRight size={13} />
    </a>
  );
}
function MedicineCard({
  medicine: m,
  country,
}: {
  medicine: Medicine;
  country: (typeof countries)[number];
}) {
  const research = useMutation(api.medicineDiscovery.researchOne);
  const disposition = useMutation(api.medicineDiscovery.setDisposition);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const evidence = m.claims.filter(
    (c) => c.verification === "page_excerpt_verified",
  );
  const market = m.markets.find((x) => x.country === country);
  const claims = evidence.filter((x) => x.country === country);
  const presence = [
    ...claims,
    ...(m.reviewSignals ?? []).filter(
      (c) =>
        c.country === country && c.verification === "page_excerpt_verified",
    ),
  ].filter((x) => x.kind === "local_presence" || x.kind === "partner");
  const regionalPresence = [
    ...evidence,
    ...(m.reviewSignals ?? []).filter(
      (c) => c.verification === "page_excerpt_verified",
    ),
  ].filter(
    (x) =>
      x.country === "Regional" &&
      (x.kind === "partner" || x.kind === "local_presence"),
  );
  const need = claims.find((c) => c.kind === "demand");
  const contact = evidence.find((c) => c.kind === "contact");
  const pending = ["queued", "running"].includes(m.researchStatus);
  const signals = commercialSignals(m, country);
  const blockers = shortlistBlockers(m, country);
  const possibleSignals = signals.filter(
    (c) =>
      c.kind === "possible_partner" ||
      c.verification !== "page_excerpt_verified",
  );
  const title = possibleSignals.length
    ? possibleSignals.some((c) => c.country === "Regional")
      ? "Possible regional agreement — review required"
      : "Possible commercial relationship — review required"
    : presence.length
      ? "Existing presence or partner to assess"
      : regionalPresence.length
        ? "Regional partner scope needs checking"
        : "Representation remains unconfirmed";
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="rounded-2xl border border-zinc-700 bg-zinc-900/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-sky-600 bg-sky-950 px-2 py-1 text-sky-100">
              {m.references.map((r) => r.authority).join(" + ")} approved
            </span>
            {m.orphan && (
              <span className="rounded-full border border-violet-500 px-2 py-1 text-violet-200">
                Orphan medicine
              </span>
            )}
            {m.advanced && (
              <span className="rounded-full border border-zinc-500 px-2 py-1 text-zinc-200">
                Advanced therapy
              </span>
            )}
          </div>
          <h2 className="text-2xl font-semibold text-white">{m.brand}</h2>
          <p className="mt-1 text-sm text-zinc-300">
            {m.inn} · {m.owner || "Owner research pending"}
          </p>
        </div>
        <span className="text-xs text-zinc-400">
          First approval in these sources
          <br />
          {date(m.firstApprovalDate)}
        </span>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-6 text-zinc-300">
        {m.indication || m.area}
      </p>
      <div
        className={`mt-4 rounded-xl border p-4 ${presence.length || market?.status === "molecule_listed" ? "border-amber-700 bg-amber-950/30" : "border-sky-800 bg-sky-950/30"}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
          {country} · Registration evidence
        </p>
        <h3 className="mt-1 font-semibold text-white">
          {market?.status === "molecule_listed"
            ? "Related medicine listed locally"
            : market?.status === "no_molecule_match"
              ? "No match in the supplied snapshot"
              : "Registration not checked"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-300">
          {market?.status === "no_molecule_match"
            ? `No related molecule or exact brand matched in the supplied ${country} snapshot. Current registration remains unconfirmed. This says nothing about representation or available rights.`
            : market?.status === "molecule_listed"
              ? `${market.matches.length}${market.matches.length === 20 ? "+" : ""} related records found. Compare the exact presentation, owner and commercial route; a molecule match is not an exact registration decision.`
              : "No complete country registry comparison is available. Targeted official checks and local partner research remain necessary."}
        </p>
        {market?.snapshotName && (
          <p className="mt-2 text-xs text-zinc-400">
            {market.snapshotName} · imported {date(market.snapshotCheckedAt!)}.
            Source content date unconfirmed.
          </p>
        )}
      </div>
      <div className="mt-4 rounded-xl border border-amber-800/70 bg-amber-950/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
          Representation and rights
        </p>
        <h3 className="mt-1 font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-zinc-200">
          {signals.length
            ? "Commercial relationships require a product and country scope review."
            : "No relationship is recorded in this evidence file. Representation and available rights remain unknown."}
        </p>
        {possibleSignals.map((c, i) => (
          <div key={`${c.url}-${i}`} className="mt-3 text-sm text-amber-100">
            <p>{c.claim}</p>
            <SourceLink url={c.url}>{c.title}</SourceLink>
          </div>
        ))}
      </div>
      {presence.length > 0 && (
        <div className="mt-4 space-y-2">
          {presence.map((c, i) => (
            <div
              key={`${c.url}-${i}`}
              className="text-sm leading-6 text-amber-100"
            >
              <p>{c.claim}</p>
              <SourceLink url={c.url}>
                {c.country} · {c.title}
              </SourceLink>
            </div>
          ))}
        </div>
      )}
      {regionalPresence.length > 0 && (
        <div className="mt-4 text-sm text-amber-100">
          <p className="font-semibold">
            Regional evidence · confirm the exact country scope
          </p>
          {regionalPresence.map((c, i) => (
            <p key={i} className="mt-2">
              {c.claim} <SourceLink url={c.url}>Source</SourceLink>
            </p>
          ))}
        </div>
      )}
      {(need || contact) && (
        <div className="mt-4 space-y-3 rounded-xl bg-zinc-950/60 p-4">
          {need && (
            <div>
              <p className="text-xs font-semibold uppercase text-sky-300">
                Why investigate · {need.country}
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-200">
                {need.claim}
              </p>
              <SourceLink url={need.url}>{need.title}</SourceLink>
            </div>
          )}
          {contact && (
            <div>
              <p className="text-xs font-semibold uppercase text-sky-300">
                Company route to check
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-200">
                {contact.claim}
              </p>
              <SourceLink url={contact.url}>{contact.title}</SourceLink>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {m.references.map((r) => (
          <SourceLink key={r.authority} url={r.url}>
            {r.authority} approval · {date(r.approvedAt)}
          </SourceLink>
        ))}
      </div>
      <details className="mt-5 border-t border-zinc-700 pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-100">
          Research evidence ({evidence.length}) and local comparisons
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-xs leading-5 text-zinc-400">
            Excerpts have been matched to retrieved source text. Findings still
            require analyst review. They do not establish available rights or an
            approved commercial opportunity. A regulatory approval does not
            establish that the medicine is commercially supplied.
          </p>
          {evidence.map((c, i) => (
            <div
              key={`${c.url}-${i}`}
              className="border-l-2 border-sky-600 pl-3"
            >
              <p className="text-xs uppercase text-sky-300">
                {c.country} · {c.kind.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-100">{c.claim}</p>
              {evidence.findIndex((x) => x.url === c.url) === i && (
                <blockquote className="mt-1 text-xs leading-5 text-zinc-400">
                  “{c.excerpt}”
                </blockquote>
              )}
              <SourceLink url={c.url}>{c.title}</SourceLink>
            </div>
          ))}
          {!evidence.length && (
            <p className="text-sm text-zinc-400">
              {pending
                ? "Research is working on local presence, territory partners, need and a public partnering route."
                : "No supporting market research has been collected yet."}
            </p>
          )}
          {market?.matches.map((r, i) => (
            <div
              key={`${r.record}-${i}`}
              className="rounded-lg border border-zinc-700 p-3 text-xs leading-5 text-zinc-300"
            >
              <strong className="text-white">{r.name}</strong> · {r.inn}
              <br />
              {r.form} · {r.strength} · {r.owner}
              <br />
              Source record: {r.record}
            </div>
          ))}
          {m.researchWarnings?.map((w, i) => (
            <p key={i} className="text-xs text-amber-200">
              {w}
            </p>
          ))}
        </div>
      </details>
      <CommercialReviewPanel medicine={m} country={country} />
      <p className="mt-4 text-sm text-zinc-300">
        <strong className="text-white">Next action: </strong>
        {signals.length
          ? "Review the named partner’s product and territory scope before approaching another supplier."
          : market?.status === "molecule_listed"
            ? "Check whether the exact product is covered and identify a differentiated access or partnering case."
            : m.claims.some((c) => c.verification === "page_excerpt_verified")
              ? "Review the cited need and company route, then verify the exact country presentation and territory rights."
              : "Research local launches, licensing partners, unmet need and the owner’s partnering route."}
      </p>
      {(error || m.researchError) && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error || m.researchError}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          disabled={pending || busy}
          onClick={() => act(() => research({ id: m._id }))}
          className="bg-sky-600 text-white hover:bg-sky-500"
        >
          <Search size={15} />
          {pending
            ? "Research in progress"
            : m.researchedAt
              ? "Refresh research"
              : "Research this medicine"}
        </Button>
        <Button
          variant="outline"
          disabled={
            busy || (m.disposition !== "shortlisted" && blockers.length > 0)
          }
          onClick={() =>
            act(() =>
              disposition({
                id: m._id,
                country,
                disposition:
                  m.disposition === "shortlisted" ? "new" : "shortlisted",
              }),
            )
          }
        >
          {m.disposition === "shortlisted" ? (
            <>
              <CheckCircle2 size={15} />
              Shortlisted
            </>
          ) : (
            "Add to actionable shortlist"
          )}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            act(() =>
              disposition({
                id: m._id,
                disposition: m.disposition === "parked" ? "new" : "parked",
              }),
            )
          }
        >
          {m.disposition === "parked" ? "Restore" : "Park"}
        </Button>
        <span className="text-xs text-zinc-400">
          {m.researchedAt
            ? `Researched ${date(m.researchedAt)}`
            : "Research not completed"}
        </span>
      </div>
    </article>
  );
}
export function MedicineDiscoveryDashboard() {
  const data = useQuery(api.medicineDiscovery.dashboard) as
    | {
        candidates: Medicine[];
        run: Doc<"medicineDiscoveryRuns"> | null;
        bounded: boolean;
      }
    | undefined;
  const start = useMutation(api.medicineDiscovery.startRun);
  const [country, setCountry] = useState<(typeof countries)[number]>("UAE");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("all");
  const [limit, setLimit] = useState(12);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const medicines = data?.candidates ?? [];
  const researched = medicines.filter((m) =>
    m.claims.some((c) => c.verification === "page_excerpt_verified"),
  );
  const shortlist = medicines.filter(
    (m) => m.disposition === "shortlisted" && m.shortlistCountry === country,
  );
  const pending = medicines.filter((m) =>
    ["running", "queued"].includes(m.researchStatus),
  );
  const filtered = medicines
    .filter(
      (m) =>
        (view === "shortlisted"
          ? m.disposition === "shortlisted" && m.shortlistCountry === country
          : view === "parked"
            ? m.disposition === "parked"
            : m.disposition !== "parked") &&
        (view !== "researched" ||
          m.claims.some((c) => c.verification === "page_excerpt_verified")) &&
        (view !== "need" ||
          m.claims.some(
            (c) =>
              c.verification === "page_excerpt_verified" &&
              c.kind === "demand" &&
              (c.country === country || c.country === "Regional"),
          )) &&
        `${m.brand} ${m.inn} ${m.owner} ${m.indication}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(
          b.claims.some((c) => c.verification === "page_excerpt_verified"),
        ) -
          Number(
            a.claims.some((c) => c.verification === "page_excerpt_verified"),
          ) ||
        b.priority - a.priority ||
        b.firstApprovalDate.localeCompare(a.firstApprovalDate),
    );
  async function run() {
    setStarting(true);
    setError("");
    try {
      await start({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-sky-300">
            KEMEDICA · New medicine discovery
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Find the next medicine worth bringing to market.
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-300">
            Recent EU and US approvals, compared with local evidence in UAE,
            Saudi Arabia and Egypt. Investigate the need, the supplier and the
            route to market.
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Research candidates are unqualified. The actionable shortlist
            requires completed checks and a recorded country-specific commercial
            review.
          </p>
        </div>
        <Button
          disabled={starting || data?.run?.status === "running"}
          onClick={run}
          className="bg-sky-600 text-white hover:bg-sky-500"
        >
          <RefreshCw size={16} />
          {starting || data?.run?.status === "running"
            ? "Collecting approvals…"
            : "Find new medicines"}
        </Button>
      </div>
      <div className="my-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [medicines.length, "Medicine records"],
          [researched.length, "With research evidence"],
          [pending.length, "Research in progress"],
          [shortlist.length, "Actionable shortlist"],
        ].map(([n, label]) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-700 bg-zinc-900 p-4"
          >
            <p className="text-2xl font-semibold text-white">
              {data ? n : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-300">{label}</p>
          </div>
        ))}
      </div>
      {data?.run && (
        <details className="mb-6 rounded-xl border border-zinc-700 px-4 py-3">
          <summary className="cursor-pointer text-sm text-zinc-300">
            Collection {data.run.status} · {date(data.run.startedAt)} ·{" "}
            {data.run.candidateCount} distinct medicines in latest run
          </summary>
          <div className="mt-3 space-y-2 text-xs text-zinc-400">
            {data.run.sourceCounts.map((s) => (
              <p key={s.url}>
                <SourceLink url={s.url}>{s.name}</SourceLink> · {s.eligible}{" "}
                eligible / {s.parsed} source records{" "}
                {s.sourceDate ? `· source updated ${date(s.sourceDate)}` : ""}
              </p>
            ))}
            {data.run.warnings.map((w, i) => (
              <p key={i} className="text-amber-200">
                {w}
              </p>
            ))}
            <p>
              Weekly approval refresh. Individual research is available on every
              card; automatic research expansion is paused while research
              quality is evaluated. EU generics, biosimilars and non-authorised
              products are excluded from this discovery feed. FDA coverage
              follows the annual novel-drug lists, not every FDA approval.
            </p>
          </div>
        </details>
      )}
      {error && (
        <p role="alert" className="mb-4 text-red-300">
          {error}
        </p>
      )}
      <div className="mb-6 flex flex-wrap gap-3">
        <Input
          aria-label="Search new medicines"
          placeholder="Search medicine, company or condition"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(12);
          }}
          className="min-w-48 flex-1"
        />
        <select
          aria-label="Discovery country"
          value={country}
          onChange={(e) => setCountry(e.target.value as typeof country)}
          className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white"
        >
          {countries.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Discovery view"
          value={view}
          onChange={(e) => {
            setView(e.target.value);
            setLimit(12);
          }}
          className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white"
        >
          <option value="all">All discoveries</option>
          <option value="researched">With research evidence</option>
          <option value="need">With local need evidence</option>
          <option value="shortlisted">Actionable shortlist</option>
          <option value="parked">Parked</option>
        </select>
      </div>
      {!data ? (
        <p className="py-10 text-zinc-400">Loading medicine discoveries…</p>
      ) : filtered.length ? (
        <>
          <p className="mb-4 text-xs text-zinc-400">
            {filtered.length} medicines · researched candidates first · source
            freshness and evidence gaps remain visible
          </p>
          <div className="grid gap-5 lg:grid-cols-2">
            {filtered.slice(0, limit).map((m) => (
              <MedicineCard key={m._id} medicine={m} country={country} />
            ))}
          </div>
          {filtered.length > limit && (
            <Button
              className="mt-6"
              variant="outline"
              onClick={() => setLimit(limit + 12)}
            >
              Show more medicines
            </Button>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-600 p-10 text-center">
          <FlaskConical className="mx-auto mb-3 text-sky-300" />
          <h2 className="text-lg font-semibold text-white">
            {medicines.length
              ? "No medicines match this view"
              : "Start with current EU and US approvals"}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {medicines.length
              ? "Change the filters or research a medicine to build its evidence file."
              : "Find new medicines will collect official approvals, compare the UAE snapshot and research the first batch."}
          </p>
        </div>
      )}
      {data?.bounded && (
        <p className="mt-4 text-amber-200">
          This view is limited to the highest-priority 1,000 medicines.
        </p>
      )}
    </section>
  );
}
