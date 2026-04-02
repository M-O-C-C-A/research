"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { GuidedFlowBanner } from "@/components/shared/GuidedFlowBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  withdrawn: "bg-red-500/15 text-red-400 border-red-500/30",
};

interface DrugDetailProps {
  drugId: string;
}

export function DrugDetail({ drugId }: DrugDetailProps) {
  const drug = useQuery(api.drugs.get, { id: drugId as Id<"drugs"> });
  const company = useQuery(
    api.companies.get,
    drug?.companyId ? { id: drug.companyId } : "skip"
  );
  const entityLinks = useQuery(
    api.drugEntityLinks.listByDrug,
    drug ? { drugId: drug._id } : "skip"
  );

  if (drug === undefined) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-3 mb-6">
        <Skeleton className="h-7 w-1/3 bg-zinc-800" />
        <Skeleton className="h-4 w-1/2 bg-zinc-800" />
        <Skeleton className="h-4 w-full bg-zinc-800" />
      </div>
    );
  }

  if (!drug) return null;

  const primaryEntity =
    entityLinks?.find((entry) => entry.relationshipType === "manufacturer" && entry.isPrimary) ??
    entityLinks?.find((entry) => entry.relationshipType === "manufacturer") ??
    entityLinks?.find(
      (entry) =>
        entry.relationshipType === "market_authorization_holder" && entry.isPrimary
    ) ??
    entityLinks?.[0];
  const primaryEntityLabel =
    primaryEntity?.company?.name ?? primaryEntity?.entityName ?? company?.name ?? drug.manufacturerName;
  const primaryEntityCountry = primaryEntity?.company?.country ?? company?.country;
  const manufacturerNames = entityLinks
    ?.filter((entry) => entry.relationshipType === "manufacturer")
    .map((entry) => entry.company?.name ?? entry.entityName)
    .filter((value): value is string => !!value);
  const visibleManufacturerNames =
    manufacturerNames && manufacturerNames.length > 0
      ? manufacturerNames
      : drug.primaryManufacturerName
        ? [drug.primaryManufacturerName]
        : drug.manufacturerName
          ? [drug.manufacturerName]
          : [];

  return (
    <div className="space-y-6 mb-6">
      <GuidedFlowBanner
        hereLabel="Product detail"
        helperText="Use this page to confirm who makes and owns the product, then decide whether the next move is whitespace review, a decision brief, or outreach."
      />

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-white">{drug.name}</h2>
              <Badge
                variant="secondary"
                className={STATUS_STYLES[drug.approvalStatus] ?? "bg-zinc-800 text-zinc-400"}
              >
                {drug.approvalStatus}
              </Badge>
            </div>
            <p className="text-sm text-zinc-500">
              {drug.genericName}
              {primaryEntityLabel ? (
                <span>
                  {" · "}
                  <span className="text-zinc-400">{primaryEntityLabel}</span>
                  {primaryEntityCountry ? (
                    <>
                      {" · "}
                      {primaryEntityCountry}
                    </>
                  ) : null}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href={`/drugs/${drugId}?tab=report`}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
            >
              Research this product
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/gaps"
              className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200"
            >
              Check market opportunity
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1">Therapeutic Area</p>
            <p className="text-sm text-zinc-300">{drug.therapeuticArea}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1">Category</p>
            <p className="text-sm text-zinc-300">{drug.category ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1">Approval Date</p>
            <p className="text-sm text-zinc-300">{drug.approvalDate ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1">Mechanism</p>
            <p className="text-sm text-zinc-300">{drug.mechanism ?? "—"}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1.5">Indication</p>
          <p className="text-sm text-zinc-300">{drug.indication}</p>
        </div>

        <div className="mt-4 grid gap-4 border-t border-zinc-800 pt-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1.5">Manufacturers</p>
            {visibleManufacturerNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {visibleManufacturerNames.map((manufacturerName) => (
                  <Badge
                    key={manufacturerName}
                    variant="secondary"
                    className={
                      manufacturerName === drug.primaryManufacturerName
                        ? "bg-cyan-500/10 text-cyan-300 border-0"
                        : "bg-zinc-800 text-zinc-300 border-0"
                    }
                  >
                    {manufacturerName}
                    {manufacturerName === drug.primaryManufacturerName ? " · primary" : ""}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-300">—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1.5">MAH / Commercial Owner</p>
            <p className="text-sm text-zinc-300">{drug.primaryMarketAuthorizationHolderName ?? "—"}</p>
          </div>
        </div>

        <div className="mt-4 border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">Entity Map</p>
          {entityLinks === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full bg-zinc-800" />
              <Skeleton className="h-10 w-full bg-zinc-800" />
            </div>
          ) : entityLinks.length === 0 ? (
            <p className="text-sm text-zinc-500">No structured entity map yet.</p>
          ) : (
            <div className="space-y-2">
              {entityLinks.map((entry) => (
                <div
                  key={entry._id}
                  className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border-0">
                      {entry.relationshipType.replaceAll("_", " ")}
                    </Badge>
                    {entry.isPrimary && (
                      <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-300 border-0">
                        primary
                      </Badge>
                    )}
                    <span className="text-sm text-white">
                      {entry.company?.name ?? entry.entityName ?? "Unnamed entity"}
                    </span>
                    {entry.company?.country && (
                      <span className="text-xs text-zinc-500">{entry.company.country}</span>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="mt-1 text-xs text-zinc-400">{entry.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {(drug.productProfile || (drug.identityEvidenceItems?.length ?? 0) > 0) && (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">Product Identity</p>
            {drug.productProfile && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
                  <p className="text-xs text-zinc-500">Strength</p>
                  <p className="mt-1 text-sm text-zinc-300">{drug.productProfile.strength ?? "—"}</p>
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
                  <p className="text-xs text-zinc-500">Dosage Form / Route</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {[drug.productProfile.dosageForm, drug.productProfile.route].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
                  <p className="text-xs text-zinc-500">Source Regions</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {drug.productProfile.sourceRegions?.join(", ") ?? "—"}
                  </p>
                </div>
              </div>
            )}
            {(drug.identityEvidenceItems?.length ?? 0) > 0 && (
              <div className="mt-3 space-y-2">
                {drug.identityEvidenceItems?.map((item, index) => (
                  <div
                    key={`${item.claim}-${index}`}
                    className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border-0">
                        {item.sourceKind.replaceAll("_", " ")}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={
                          item.confidence === "confirmed"
                            ? "bg-emerald-500/10 text-emerald-300 border-0"
                            : item.confidence === "likely"
                              ? "bg-blue-500/10 text-blue-300 border-0"
                              : "bg-zinc-800 text-zinc-400 border-0"
                        }
                      >
                        {item.confidence}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-zinc-300">{item.claim}</p>
                    {(item.title || item.url) && (
                      <p className="mt-1 text-xs text-zinc-500">
                        {item.title ?? item.url}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
