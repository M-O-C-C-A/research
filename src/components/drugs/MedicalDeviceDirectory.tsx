"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";
import { AddDrugButton } from "./AddDrugDialog";
import { ArrowRight, MonitorSmartphone, Search } from "lucide-react";

export function MedicalDeviceDirectory() {
  const [search, setSearch] = useState("");
  const devices = useQuery(api.drugs.listMedicalDevicesEnriched, {
    search: search || undefined,
  });

  if (devices === undefined) {
    return <TableSkeleton rows={5} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search devices..."
            className="border-zinc-800 bg-zinc-900 pl-9 text-white placeholder:text-zinc-600"
          />
        </div>
        <AddDrugButton
          label="Add medical device"
          dialogTitle="Add Medical Device"
          submitLabel="Add Medical Device"
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-sm text-zinc-300">
          Use this lane for EU or MENA medical devices that are not covered by the FDA/EMA
          medicine sync. Add them manually, attach the manufacturer, and then work the same
          market, pricing, and outreach process.
        </p>
      </div>

      {devices.length === 0 ? (
        <EmptyState
          icon={<MonitorSmartphone className="h-10 w-10" />}
          title={search ? "No medical devices found" : "No medical devices yet"}
          description={
            search
              ? "Try a different search term, manufacturer name, or device family."
              : "Add a medical device manually when it is not covered by the synced medicine registries."
          }
          action={
            !search ? (
              <AddDrugButton
                label="Add medical device"
                dialogTitle="Add Medical Device"
                submitLabel="Add Medical Device"
              />
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {devices.map((device) => (
            <div
              key={device._id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/drugs/${device._id}`}
                    className="text-lg font-semibold text-white hover:text-[var(--brand-300)]"
                  >
                    {device.name}
                  </Link>
                  <p className="mt-1 text-sm text-zinc-500">
                    {device.genericName} · {device.category ?? "Medical Device"}
                  </p>
                </div>
                <Badge className="border-0 bg-[color:var(--brand-surface)] text-[var(--brand-300)]">
                  device
                </Badge>
              </div>

              <div className="mt-4 space-y-2 text-sm text-zinc-300">
                <p>
                  <span className="text-zinc-500">Primary manufacturer:</span>{" "}
                  {device.primaryManufacturerName}
                </p>
                <p>
                  <span className="text-zinc-500">Therapeutic area:</span>{" "}
                  {device.therapeuticArea}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {device.manufacturerNames.slice(0, 3).map((name) => (
                  <Badge
                    key={`${device._id}-${name}`}
                    className="border-0 bg-zinc-800 text-zinc-300"
                  >
                    {name}
                  </Badge>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Link
                  href={`/drugs/${device._id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-300)] hover:text-white"
                >
                  Open device
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {device.primaryManufacturerCompanyId ? (
                  <Link
                    href={`/companies/${device.primaryManufacturerCompanyId}`}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Open company
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
