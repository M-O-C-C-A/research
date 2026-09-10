"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { Infer } from "convex/values";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { studyInput } from "../../../convex/commercialAssessmentValidators";
import { buildCommercialOutput } from "../../../convex/commercialOutputPolicy";
import {
  calculateCompanyFit,
  REGIONAL_MARKETS,
  type CompanyFitInput,
  type ChannelStatus,
  type ForecastScenario,
} from "../../../convex/opportunityAssessmentPolicy";
import { Button } from "@/components/ui/button";

type Study = Infer<typeof studyInput>;
const textFields = {
  therapeuticArea: "Therapeutic area",
  epidemiology: "Prevalence / incidence and dated sources",
  targetPatients: "Patients, procedures or customers and eligibility",
  decisionMakers: "Decision-makers, institutions and country roles",
  marketDynamics: "Public/private access and market dynamics",
  reimbursement: "Reimbursement constraints and evidence",
  affordability: "Affordability and pricing sensitivity",
  competition: "Competitors and market need",
  reputation: "Company reputation and sources",
  willingness: "Company willingness and partnering evidence",
  feasibility: "Regulatory, MAH, supply and launch feasibility",
  assumptionEvidence:
    "Sources or explicit assumptions for each forecast driver (including price, fees, FX and costs)",
} as const;
const scenarioFields = {
  eligiblePatients: "Eligible patients / procedures / customers",
  reachablePct: "Accessible share %",
  reimbursementReachPct: "Reimbursement / affordability reach %",
  annualPatientGrowthPct: "Annual population growth %",
  unitsPerPatient: "Units per patient per year",
  netPrice: "Private net selling price USD / unit",
  publicSharePct: "Public channel share %",
  tenderDiscountPct: "Public discount vs private %",
  annualPriceGrowthPct: "Annual price change %",
  launchDelayMonths: "Launch delay in months",
  kemedicaSharePct: "KEMEDICA revenue / fee share %",
  unitCost: "KEMEDICA variable cost USD / unit",
  annualOperatingCost: "Annual operating cost USD",
  upfrontCost: "Upfront registration / setup cost USD",
  workingCapitalPct: "Working capital % of sales",
  probabilityOfSuccessPct: "Probability of success %",
} as const;
const inputClass =
  "mt-1 w-full rounded border border-zinc-500 bg-zinc-950 p-2 text-sm text-white";
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
function number(form: FormData, key: string) {
  const raw = String(form.get(key) ?? "").trim();
  if (!raw || !Number.isFinite(Number(raw))) throw new Error(`Complete ${key}`);
  return Number(raw);
}
function readStudy(form: FormData, priceCount: number): Study {
  const texts = Object.fromEntries(
    Object.keys(textFields).map((k) => [k, String(form.get(k) ?? "")]),
  ) as Pick<Study, keyof typeof textFields>;
  const scenarios = (["downside", "base", "upside"] as const).map((name) => ({
    name,
    ...Object.fromEntries(
      Object.keys(scenarioFields).map((k) => [k, number(form, `${name}.${k}`)]),
    ),
    adoptionPct: [1, 2, 3, 4, 5].map((y) =>
      number(form, `${name}.adoption${y}`),
    ),
  })) as ForecastScenario[];
  const prices = Array.from({ length: priceCount }, (_, i) => {
    const get = (key: string) => String(form.get(`price${i}.${key}`) ?? "");
    return {
      kind: get("kind") as Study["prices"][number]["kind"],
      country: get("country"),
      amount: number(form, `price${i}.amount`),
      currency: get("currency"),
      unitsPerPack: number(form, `price${i}.unitsPerPack`),
      unitBasis: get("unitBasis"),
      fxToUsd: number(form, `price${i}.fxToUsd`),
      fxSource: get("fxSource"),
      fxObservedAt: Date.parse(get("fxObservedAt")) || 0,
      priceType: get("priceType"),
      presentation: get("presentation"),
      source: get("source"),
      observedAt: Date.parse(get("observedAt")) || 0,
      comparable: get("comparable") === "on",
    };
  });
  return {
    ...texts,
    unitBasis: String(form.get("unitBasis") ?? ""),
    startYear: number(form, "startYear"),
    scenarios,
    prices,
  };
}

function StudyEditor({
  opportunityId,
  country,
  study,
}: {
  opportunityId: Id<"decisionOpportunities">;
  country: "UAE" | "Saudi Arabia" | "Egypt";
  study?: Study;
}) {
  const save = useMutation(api.commercialAssessments.saveStudy);
  const [priceCount, setPriceCount] = useState(study?.prices.length ?? 0);
  const [preview, setPreview] = useState<ReturnType<
    typeof buildCommercialOutput
  > | null>(study ? buildCommercialOutput(study) : null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="space-y-5"
      onChange={(e) => {
        try {
          setPreview(
            buildCommercialOutput(
              readStudy(new FormData(e.currentTarget), priceCount),
            ),
          );
        } catch {
          setPreview(null);
        }
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          const input = readStudy(new FormData(e.currentTarget), priceCount);
          await save({ opportunityId, country, input });
          setPreview(buildCommercialOutput(input));
          setMessage(
            "Saved. Commercial approval is required for this revised forecast.",
          );
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Save failed");
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(textFields).map(([key, title]) => (
          <label className="text-sm text-zinc-200" key={key}>
            {title}
            <textarea
              className={inputClass}
              name={key}
              defaultValue={study?.[key as keyof typeof textFields] ?? ""}
              rows={2}
              required
            />
          </label>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          Forecast start year
          <input
            className={inputClass}
            name="startYear"
            type="number"
            defaultValue={study?.startYear ?? new Date().getFullYear()}
            required
          />
        </label>
        <label>
          Comparable unit basis (e.g. tablet, vial, treatment)
          <input
            className={inputClass}
            name="unitBasis"
            defaultValue={study?.unitBasis ?? ""}
            required
          />
        </label>
      </div>
      <h3 className="text-lg font-semibold">Price corridor</h3>
      <p className="text-sm text-zinc-300">
        Germany reference, UAE/KSA registered prices and tender benchmarks. Keep
        price type and pack basis explicit. Only confirmed comparable units
        enter the corridor; directional sources remain context.
      </p>
      {Array.from({ length: priceCount }, (_, i) => {
        const p = study?.prices[i];
        return (
          <fieldset
            key={i}
            className="grid gap-3 rounded border border-zinc-500 p-3 md:grid-cols-3"
          >
            <legend>Price anchor {i + 1}</legend>
            <label>
              Anchor
              <select
                className={inputClass}
                name={`price${i}.kind`}
                defaultValue={p?.kind ?? "germany_reference"}
              >
                {[
                  "germany_reference",
                  "gcc_registered",
                  "tender",
                  "directional",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {(
              [
                "country",
                "currency",
                "unitBasis",
                "priceType",
                "presentation",
                "source",
                "fxSource",
              ] as const
            ).map((k) => (
              <label key={k}>
                {k}
                <input
                  className={inputClass}
                  name={`price${i}.${k}`}
                  defaultValue={p?.[k] ?? ""}
                  required={k !== "fxSource"}
                />
              </label>
            ))}
            {(["amount", "unitsPerPack", "fxToUsd"] as const).map((k) => (
              <label key={k}>
                {k}
                <input
                  className={inputClass}
                  name={`price${i}.${k}`}
                  type="number"
                  step="any"
                  defaultValue={p?.[k] ?? ""}
                  required
                />
              </label>
            ))}
            {(["observedAt", "fxObservedAt"] as const).map((k) => (
              <label key={k}>
                {k}
                <input
                  className={inputClass}
                  name={`price${i}.${k}`}
                  type="date"
                  defaultValue={
                    p?.[k] ? new Date(p[k]).toISOString().slice(0, 10) : ""
                  }
                  required
                />
              </label>
            ))}
            <label className="flex items-center gap-2">
              <input
                name={`price${i}.comparable`}
                type="checkbox"
                defaultChecked={p?.comparable}
              />
              Presentation and unit basis are comparable
            </label>
          </fieldset>
        );
      })}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPriceCount((n) => n + 1)}
        >
          Add price anchor
        </Button>
        {priceCount > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPriceCount((n) => n - 1);
              setPreview(null);
            }}
          >
            Remove last anchor
          </Button>
        )}
      </div>
      <h3 className="text-lg font-semibold">
        Volume reality check and margin simulator
      </h3>
      <p className="text-sm text-zinc-300">
        All monetary inputs are USD. KEMEDICA share is relevant to the
        commercial assessment or forecast; it need not be a signed fee. Enter
        zero explicitly where a cost does not apply. Operating costs start in
        year one; working capital remains tied up at year five.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Driver</th>
              {["downside", "base", "upside"].map((n) => (
                <th key={n} className="min-w-32 p-2 capitalize">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(scenarioFields).map(([key, title]) => (
              <tr key={key}>
                <td>{title}</td>
                {(["downside", "base", "upside"] as const).map((n) => (
                  <td className="p-1" key={n}>
                    <input
                      aria-label={`${n} ${title}`}
                      className={inputClass}
                      type="number"
                      step="any"
                      name={`${n}.${key}`}
                      defaultValue={
                        study?.scenarios.find((s) => s.name === n)?.[
                          key as keyof typeof scenarioFields
                        ] ?? ""
                      }
                      required
                    />
                  </td>
                ))}
              </tr>
            ))}
            {[1, 2, 3, 4, 5].map((y) => (
              <tr key={y}>
                <td>Year {y} physician adoption %</td>
                {["downside", "base", "upside"].map((n) => (
                  <td className="p-1" key={n}>
                    <input
                      aria-label={`${n} year ${y} adoption`}
                      className={inputClass}
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      name={`${n}.adoption${y}`}
                      defaultValue={
                        study?.scenarios.find((s) => s.name === n)?.adoptionPct[
                          y - 1
                        ] ?? ""
                      }
                      required
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview ? (
        <div className="space-y-4 rounded border border-sky-500 p-4">
          <h3 className="font-semibold">Scenario outputs · USD</h3>
          <div className="grid gap-3 lg:grid-cols-3">
            {preview.forecasts.map((f) => (
              <div key={f.name}>
                <h4 className="capitalize">{f.name}</h4>
                <p>
                  Five-year cash: <strong>{money(f.cumulativeCash)}</strong>
                </p>
                <p>Risk-adjusted cash: {money(f.riskAdjustedCash)}</p>
                <p>
                  Payback:{" "}
                  {f.paybackYear
                    ? `Year ${f.paybackYear}`
                    : "Beyond five years"}
                </p>
                <table className="mt-2 w-full text-xs">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Patients</th>
                      <th>Sales</th>
                      <th>Cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.years.map((y) => (
                      <tr key={y.year}>
                        <td>{y.year}</td>
                        <td>{Math.round(y.patients).toLocaleString()}</td>
                        <td>{money(y.revenue)}</td>
                        <td>{money(y.cash)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <h3 className="font-semibold">Entry strategy recommendation</h3>
          <p>
            {preview.recommendation.channel} ·{" "}
            {preview.recommendation.pricingBand}
          </p>
          <p>{preview.recommendation.sequence}</p>
          <p className="text-sm text-amber-200">
            {preview.recommendation.caution}
          </p>
          {preview.prices.map((p, i) => (
            <p className="text-xs" key={i}>
              {p.country} · {p.priceType}: {money(p.unitPriceUsd)}/{p.unitBasis}{" "}
              ·{" "}
              {p.included
                ? "Included"
                : "Excluded: check comparability, source, dates, FX and anchor region"}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-amber-200">
          Complete the numeric drivers to see live scenarios. Empty inputs are
          unresolved.
        </p>
      )}
      <Button disabled={saving} type="submit">
        {saving ? "Saving…" : "Save assessment and forecast"}
      </Button>
      <p role="status" className="text-sm">
        {message}
      </p>
    </form>
  );
}

function FitEditor({
  opportunityId,
  input,
}: {
  opportunityId: Id<"decisionOpportunities">;
  input?: CompanyFitInput;
}) {
  const save = useMutation(api.commercialAssessments.saveFit);
  const [message, setMessage] = useState("");
  const result = input ? calculateCompanyFit(input) : null;
  return (
    <details className="rounded border border-zinc-500 p-4">
      <summary className="cursor-pointer font-semibold">
        Company fit · {result ? `${result.score} points` : "Not assessed"}
      </summary>
      <form
        className="mt-4 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const get = (k: string) => String(f.get(k) ?? "");
          const signal = (k: string) => ({
            value: get(k) === "on",
            source: get(`${k}.source`),
            observedAt: Date.parse(get(`${k}.date`)) || 0,
          });
          try {
            await save({
              opportunityId,
              input: {
                channels: REGIONAL_MARKETS.map((country) => ({
                  country,
                  status: get(`${country}.status`) as ChannelStatus,
                  partner: get(`${country}.partner`),
                  productScope: get(`${country}.scope`),
                  source: get(`${country}.source`),
                  observedAt: Date.parse(get(`${country}.date`)) || 0,
                })),
                staffCount: get("staff") ? Number(get("staff")) : undefined,
                staffSource: get("staffSource"),
                staffObservedAt: Date.parse(get("staffDate")) || undefined,
                outLicensed: signal("outLicensed"),
                partneringContact: signal("partneringContact"),
                conferenceExhibitor: signal("conferenceExhibitor"),
              },
            });
            setMessage("Company fit saved.");
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Save failed");
          }
        }}
      >
        <p className="text-sm text-zinc-300">
          Evidence must be dated and sourced. NONE requires checks across all
          seven markets. Relationships reduce priority but remain eligible;
          actual country rights are reviewed separately.
        </p>
        {REGIONAL_MARKETS.map((country) => {
          const row = input?.channels.find((c) => c.country === country);
          return (
            <fieldset className="grid gap-2 md:grid-cols-5" key={country}>
              <legend className="text-sm font-semibold">{country}</legend>
              <select
                aria-label={`${country} channel`}
                className={inputClass}
                name={`${country}.status`}
                defaultValue={row?.status ?? "UNKNOWN"}
              >
                {[
                  "UNKNOWN",
                  "NONE",
                  "DISTRIBUTOR_ONLY",
                  "EXCLUSIVE_AGENT",
                  "OWN_AFFILIATE",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {(["partner", "scope", "source", "date"] as const).map((k) => (
                <input
                  aria-label={`${country} ${k}`}
                  key={k}
                  className={inputClass}
                  placeholder={k}
                  name={`${country}.${k}`}
                  type={k === "date" ? "date" : "text"}
                  defaultValue={
                    k === "date"
                      ? row?.observedAt
                        ? new Date(row.observedAt).toISOString().slice(0, 10)
                        : ""
                      : k === "scope"
                        ? (row?.productScope ?? "")
                        : (row?.[k] ?? "")
                  }
                />
              ))}
            </fieldset>
          );
        })}
        <div className="grid gap-2 md:grid-cols-3">
          <label>
            Staff count
            <input
              className={inputClass}
              name="staff"
              type="number"
              min="0"
              defaultValue={input?.staffCount ?? ""}
            />
          </label>
          <label>
            Staff source
            <input
              className={inputClass}
              name="staffSource"
              defaultValue={input?.staffSource ?? ""}
            />
          </label>
          <label>
            Staff evidence date
            <input
              className={inputClass}
              name="staffDate"
              type="date"
              defaultValue={
                input?.staffObservedAt
                  ? new Date(input.staffObservedAt).toISOString().slice(0, 10)
                  : ""
              }
            />
          </label>
        </div>
        {(
          [
            ["outLicensed", "Out-licensed another emerging region (+35)"],
            ["partneringContact", "Partnering page or BD contact (+20)"],
            ["conferenceExhibitor", "Partnering conference exhibitor (+15)"],
          ] as const
        ).map(([key, title]) => (
          <div className="grid gap-2 md:grid-cols-3" key={key}>
            <label>
              <input
                type="checkbox"
                name={key}
                defaultChecked={input?.[key].value}
              />{" "}
              {title}
            </label>
            <input
              aria-label={`${title} source`}
              className={inputClass}
              name={`${key}.source`}
              placeholder="Source and relevant excerpt"
              defaultValue={input?.[key].source ?? ""}
            />
            <input
              aria-label={`${title} date`}
              className={inputClass}
              type="date"
              name={`${key}.date`}
              defaultValue={
                input?.[key].observedAt
                  ? new Date(input[key].observedAt).toISOString().slice(0, 10)
                  : ""
              }
            />
          </div>
        ))}
        {result && (
          <p className="text-sm">
            {Object.entries(result.contributions)
              .map(([k, n]) => `${k}: ${n > 0 ? "+" : ""}${n}`)
              .join(" · ")}
          </p>
        )}
        <Button type="submit">Save company fit</Button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}

export function CommercialAssessmentWorkspace({
  opportunityId,
}: {
  opportunityId: string;
}) {
  const id = opportunityId as Id<"decisionOpportunities">;
  const [country, setCountry] = useState<"UAE" | "Saudi Arabia" | "Egypt">(
    "UAE",
  );
  const data = useQuery(api.commercialAssessments.get, {
    opportunityId: id,
    country,
  });
  const log = useQuery(api.sourceAccess.latest, { opportunityId: id });
  const runLog = useAction(api.sourceAccess.run);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  return (
    <section
      className="space-y-5 rounded-xl border border-zinc-500 bg-zinc-900 p-5 text-zinc-100"
      id="commercial-assessment"
    >
      <h2 className="text-xl font-semibold">
        Commercial assessment and feasibility
      </h2>
      <Button
        disabled={running}
        onClick={async () => {
          setRunning(true);
          setError("");
          try {
            await runLog({ opportunityId: id });
          } catch (e) {
            setError(String(e));
          } finally {
            setRunning(false);
          }
        }}
      >
        {running ? "Checking sources…" : "Run source-access log"}
      </Button>
      {error && <p role="alert">{error}</p>}
      {log && (
        <details>
          <summary className="cursor-pointer">
            Source access · {new Date(log.completedAt).toLocaleString()}
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {log.entries.map(
              (entry: {
                name: string;
                url: string;
                status: string;
                note: string;
              }) => (
                <li key={entry.url}>
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-300 underline"
                  >
                    {entry.name}
                  </a>{" "}
                  · {entry.status}
                  <p className="text-zinc-300">{entry.note}</p>
                </li>
              ),
            )}
          </ul>
        </details>
      )}
      {data && (
        <FitEditor
          key={data.fit?._id ?? "new-fit"}
          opportunityId={id}
          input={data.fit?.input}
        />
      )}
      <label className="block">
        Forecast market
        <select
          className={inputClass}
          value={country}
          onChange={(e) => setCountry(e.target.value as typeof country)}
        >
          {["UAE", "Saudi Arabia", "Egypt"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      {data && (
        <details className="rounded border border-zinc-500 p-3">
          <summary className="cursor-pointer">
            Existing registry, price and sales evidence
          </summary>
          <p className="my-2 text-sm">
            Use the exact pack, strength and unit basis when adding an anchor.
            Unaccepted snapshots are for review only.
          </p>
          {data.registryRows.map(
            (group: {
              fileName: string;
              coverage?: string;
              rows: Array<{
                _id: string;
                productName: string;
                strength?: string;
                form?: string;
                packSize?: string;
                supplierName?: string;
                mahName?: string;
                manufacturerName?: string;
                priceAed?: string;
                sourceRowNumber: number;
                sourceSheet: string;
              }>;
            }) => (
              <div key={group.fileName} className="my-3">
                <h4 className="font-semibold">
                  {group.fileName} · {group.coverage}
                </h4>
                {group.rows.map((row) => (
                  <p key={row._id} className="mt-2 text-sm">
                    {row.productName} · {row.strength} · {row.form} · pack{" "}
                    {row.packSize ?? "unknown"} · AED{" "}
                    {row.priceAed ?? "unknown"} · MAH {row.mahName ?? "unknown"}{" "}
                    · manufacturer {row.manufacturerName ?? "unknown"} ·
                    supplier {row.supplierName ?? "unknown"} · {row.sourceSheet}
                    , row {row.sourceRowNumber}
                  </p>
                ))}
              </div>
            ),
          )}
          {data.prices.map(
            (p: {
              _id: string;
              amount: number;
              currency: string;
              priceType: string;
              sourceUrl?: string;
              sourceTitle: string;
              country: string;
              unitBasis?: string;
            }) => (
              <p key={p._id} className="my-2 text-sm">
                {p.country} · {p.priceType} · {p.currency} {p.amount} /{" "}
                {p.unitBasis ?? "basis unconfirmed"} ·{" "}
                <a className="text-sky-300 underline" href={p.sourceUrl}>
                  {p.sourceTitle}
                </a>
              </p>
            ),
          )}
          {data.sales.map(
            (row: {
              _id: string;
              product: string;
              fileName: string;
              sourceRow: number;
              observations: Array<{
                period: string;
                value?: number;
                units?: number;
              }>;
            }) => (
              <div key={row._id} className="my-3 text-sm">
                <h4>
                  {row.product} · {row.fileName}, row {row.sourceRow}
                </h4>
                <p>
                  Currency: LC (unconfirmed). Unit definition requires review.
                </p>
                {row.observations.map((o) => (
                  <span className="mr-3 inline-block" key={o.period}>
                    {o.period}: value {o.value ?? "missing"}, units{" "}
                    {o.units ?? "missing"}
                  </span>
                ))}
              </div>
            ),
          )}
        </details>
      )}
      {data === undefined ? (
        <p>Loading assessment…</p>
      ) : (
        <StudyEditor
          key={`${country}-${data.study?._id ?? "new"}`}
          opportunityId={id}
          country={country}
          study={data.study?.input}
        />
      )}
    </section>
  );
}
