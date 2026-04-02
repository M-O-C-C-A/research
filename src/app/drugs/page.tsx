import { PageHeader } from "@/components/shared/PageHeader";
import { ProductDirectoryTabs } from "@/components/drugs/ProductDirectoryTabs";
import Link from "next/link";
import { Suspense } from "react";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Product Directory | ${BRAND_NAME}` };

export default function DrugsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <PageHeader
        title="Product Directory"
        description="Browse products to evaluate ownership, manufacturer coverage, and EU-to-MENA whitespace before preparing outreach."
        action={
          <Link
            href="/gaps"
            className="inline-flex items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
          >
            Check market opportunity
          </Link>
        }
      />
      <Suspense fallback={null}>
        <ProductDirectoryTabs />
      </Suspense>
    </main>
  );
}
