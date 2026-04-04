import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `How Matching Works | ${BRAND_NAME}` };

const steps = [
  {
    title: "1. FDA and EMA create the external reference set",
    body:
      "The app syncs FDA and EMA records into source-backed product records. Those sources establish that a product exists, what its brand and INN are, who owns it, and where it is approved.",
  },
  {
    title: "2. The canonical product graph merges equivalent products",
    body:
      "FDA and EMA records are normalized into one canonical product family. That lets the app treat brand variants, INN naming, and ownership roles as one structured product identity instead of separate raw rows.",
  },
  {
    title: "3. Your UAE workbook is parsed and matched conservatively",
    body:
      "Each UAE row is matched into the internal product registry using exact brand first, then generic plus manufacturer or supplier context. Ambiguous rows stay in review instead of being force-linked.",
  },
  {
    title: "4. Applied UAE rows become market evidence",
    body:
      "Once a UAE row is applied, it updates the product's UAE market presence, availability status, official-registry evidence, and UAE price evidence when Price (AED) is present.",
  },
  {
    title: "5. The GCC++ gap engine compares approval truth vs market truth",
    body:
      "The product-led gap engine checks whether a canonical FDA/EMA-approved product is absent in UAE, present under a different brand, present generically, or already formally registered.",
  },
  {
    title: "6. The app decides whether there is a real opportunity",
    body:
      "A product can become a pure whitespace opportunity, a different-brand opportunity, a generic-pressure opportunity, or no opportunity at all if the UAE evidence shows it is already present.",
  },
] as const;

const outcomes = [
  "Absent in UAE despite FDA or EMA approval",
  "Present in UAE under a different brand",
  "Present in UAE as a generic or INN equivalent",
  "Already formally registered, so whitespace should be reduced",
  "Biologic or biosimilar opportunity",
  "Off-patent or near-expiry opportunity",
] as const;

export default function MatchingHelpPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="How FDA, EMA, and UAE matching works"
        description="This page explains how KEMEDICA compares FDA and EMA product intelligence against the UAE official directory to identify GCC++ opportunities."
        breadcrumbs={[
          { label: "Products", href: "/drugs" },
          { label: "How Matching Works" },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/drugs"
              className="inline-flex items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
            >
              Open products
            </Link>
            <Link
              href="/drugs/imports"
              className="inline-flex items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
            >
              Open UAE imports
            </Link>
          </div>
        }
      />

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
          System flow
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.title}
              className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
            >
              <p className="text-sm font-semibold text-white">{step.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
            In plain language
          </p>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
            <p>
              FDA and EMA establish <span className="text-white">approval truth</span>: the product exists,
              what it is called, who owns it, and whether it is approved abroad.
            </p>
            <p>
              The UAE workbook establishes <span className="text-white">market truth</span>: whether the
              product is actually listed in UAE, under what brand, with what status, and sometimes
              at what official registered price.
            </p>
            <p>
              The gap engine compares those two truths. If the product is approved abroad but not
              present in UAE, that strengthens whitespace. If it is present in UAE under another
              brand or as a generic, the app reduces or reframes the opportunity instead of
              treating it as clean absence.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
            Opportunity outcomes
          </p>
          <div className="mt-4 space-y-2">
            {outcomes.map((item) => (
              <div
                key={item}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
