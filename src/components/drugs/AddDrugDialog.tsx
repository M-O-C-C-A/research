"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  THERAPEUTIC_AREAS,
  APPROVAL_STATUSES,
  DRUG_CATEGORIES,
} from "@/lib/constants";
import { Plus, Trash2 } from "lucide-react";

type ManufacturerEntry = {
  companyId: string;
  entityName: string;
};

function createManufacturerEntry(companyId = "", entityName = ""): ManufacturerEntry {
  return { companyId, entityName };
}

interface AddDrugDialogProps {
  companyId?: string;
  open: boolean;
  onClose: () => void;
}

export function AddDrugDialog({ companyId, open, onClose }: AddDrugDialogProps) {
  const [name, setName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [therapeuticArea, setTherapeuticArea] = useState("");
  const [indication, setIndication] = useState("");
  const [mechanism, setMechanism] = useState("");
  const [approvalStatus, setApprovalStatus] = useState<
    "approved" | "pending" | "withdrawn"
  >("approved");
  const [approvalDate, setApprovalDate] = useState("");
  const [category, setCategory] = useState("");
  // For standalone entry (no company pre-selected)
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyId ?? "");
  const [manufacturers, setManufacturers] = useState<ManufacturerEntry[]>([
    createManufacturerEntry(companyId ?? ""),
  ]);
  const [marketAuthorizationHolderName, setMarketAuthorizationHolderName] = useState("");
  const [loading, setLoading] = useState(false);

  const companies = useQuery(api.companies.list, {});
  const createDrug = useMutation(api.drugs.createWithEntities);

  function updateManufacturer(
    index: number,
    patch: Partial<ManufacturerEntry>
  ) {
    setManufacturers((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry
      )
    );
  }

  function addManufacturer() {
    setManufacturers((current) => [...current, createManufacturerEntry()]);
  }

  function removeManufacturer(index: number) {
    setManufacturers((current) => {
      if (current.length === 1) {
        return [createManufacturerEntry(selectedCompanyId)];
      }
      return current.filter((_, entryIndex) => entryIndex !== index);
    });
  }

  function reset() {
    setName("");
    setGenericName("");
    setTherapeuticArea("");
    setIndication("");
    setMechanism("");
    setApprovalStatus("approved");
    setApprovalDate("");
    setCategory("");
    setManufacturers([createManufacturerEntry(companyId ?? "")]);
    setMarketAuthorizationHolderName("");
    if (!companyId) setSelectedCompanyId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !genericName || !therapeuticArea || !indication) return;

    const manufacturerEntries = manufacturers.filter(
      (entry) => entry.companyId || entry.entityName.trim()
    );
    const effectiveManufacturers =
      manufacturerEntries.length > 0
        ? manufacturerEntries
        : selectedCompanyId
          ? [createManufacturerEntry(selectedCompanyId)]
          : [];
    const primaryManufacturer = effectiveManufacturers[0];
    const primaryManufacturerName = primaryManufacturer
      ? primaryManufacturer.companyId
        ? (companies ?? []).find((company) => company._id === primaryManufacturer.companyId)
            ?.name
        : primaryManufacturer.entityName.trim()
      : undefined;

    setLoading(true);
    try {
      await createDrug({
        companyId: selectedCompanyId
          ? (selectedCompanyId as Id<"companies">)
          : undefined,
        manufacturerName:
          !selectedCompanyId && primaryManufacturerName
            ? primaryManufacturerName
            : undefined,
        primaryManufacturerName: primaryManufacturerName || undefined,
        primaryMarketAuthorizationHolderName:
          marketAuthorizationHolderName || undefined,
        name,
        genericName,
        therapeuticArea,
        indication,
        mechanism: mechanism || undefined,
        approvalStatus,
        approvalDate: approvalDate || undefined,
        category: category || undefined,
        entityLinks: [
          ...effectiveManufacturers.map((entry, index) => ({
            ...(entry.companyId
              ? { companyId: entry.companyId as Id<"companies"> }
              : { entityName: entry.entityName.trim() }),
            relationshipType: "manufacturer" as const,
            isPrimary: index === 0,
            confidence: entry.companyId
              ? ("confirmed" as const)
              : ("likely" as const),
          })),
          ...(marketAuthorizationHolderName
            ? [
                {
                  entityName: marketAuthorizationHolderName.trim(),
                  relationshipType: "market_authorization_holder" as const,
                  isPrimary: true,
                  confidence: "likely" as const,
                },
              ]
            : []),
        ],
      });
      reset();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Add Drug</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Company / Manufacturer — only shown when no company pre-set */}
          {!companyId && (
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Primary Tracked Entity</label>
              <Select
                value={selectedCompanyId}
                onValueChange={(v) => {
                  setSelectedCompanyId(v ?? "");
                  setManufacturers((current) => {
                    if (current.length === 0) return [createManufacturerEntry(v ?? "")];
                    const [first, ...rest] = current;
                    if (first.companyId || first.entityName.trim()) return current;
                    return [createManufacturerEntry(v ?? ""), ...rest];
                  });
                }}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Select from registry (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="" className="text-zinc-400 hover:bg-zinc-700">
                    — Enter manually —
                  </SelectItem>
                  {(companies ?? []).map((c) => (
                    <SelectItem
                      key={c._id}
                      value={c._id}
                      className="text-white hover:bg-zinc-700"
                    >
                      {c.name} ({c.country})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">
                This stays the main company anchor for company pages and related workflows.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-sm text-zinc-400">Manufacturers</label>
                <p className="mt-1 text-xs text-zinc-500">
                  Add the primary manufacturer first, then any additional manufacturers.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addManufacturer}>
                <Plus className="h-3.5 w-3.5" />
                Add manufacturer
              </Button>
            </div>

            <div className="space-y-3">
              {manufacturers.map((manufacturer, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">
                      {index === 0 ? "Primary manufacturer" : `Additional manufacturer ${index}`}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeManufacturer(index)}
                      disabled={manufacturers.length === 1}
                      className="text-zinc-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Select
                      value={manufacturer.companyId}
                      onValueChange={(value) =>
                        updateManufacturer(index, {
                          companyId: value ?? "",
                          entityName: value ? "" : manufacturer.entityName,
                        })
                      }
                    >
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue placeholder="Select company from registry (optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="" className="text-zinc-400 hover:bg-zinc-700">
                          — Enter manually —
                        </SelectItem>
                        {(companies ?? []).map((company) => (
                          <SelectItem
                            key={company._id}
                            value={company._id}
                            className="text-white hover:bg-zinc-700"
                          >
                            {company.name} ({company.country})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {!manufacturer.companyId && (
                      <Input
                        value={manufacturer.entityName}
                        onChange={(e) =>
                          updateManufacturer(index, {
                            entityName: e.target.value,
                            companyId: "",
                          })
                        }
                        placeholder="e.g. Bayer AG"
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">
              MAH / Commercial Owner
            </label>
            <Input
              value={marketAuthorizationHolderName}
              onChange={(e) => setMarketAuthorizationHolderName(e.target.value)}
              placeholder="Optional if different from the manufacturer"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Brand Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Keytruda"
                required
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Generic / INN *</label>
              <Input
                value={genericName}
                onChange={(e) => setGenericName(e.target.value)}
                placeholder="e.g. pembrolizumab"
                required
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Therapeutic Area *</label>
              <Select
                value={therapeuticArea}
                onValueChange={(v) => setTherapeuticArea(v ?? "")}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {THERAPEUTIC_AREAS.map((a) => (
                    <SelectItem
                      key={a}
                      value={a}
                      className="text-white hover:bg-zinc-700"
                    >
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Category</label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v ?? "")}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {DRUG_CATEGORIES.map((c) => (
                    <SelectItem
                      key={c}
                      value={c}
                      className="text-white hover:bg-zinc-700"
                    >
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Indication *</label>
            <Textarea
              value={indication}
              onChange={(e) => setIndication(e.target.value)}
              placeholder="What disease or condition does this drug treat?"
              rows={2}
              required
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Mechanism of Action</label>
            <Input
              value={mechanism}
              onChange={(e) => setMechanism(e.target.value)}
              placeholder="e.g. PD-1 inhibitor"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Approval Status *</label>
              <Select
                value={approvalStatus}
                onValueChange={(v) =>
                  setApprovalStatus(
                    (v ?? "approved") as typeof approvalStatus
                  )
                }
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {APPROVAL_STATUSES.map((s) => (
                    <SelectItem
                      key={s.value}
                      value={s.value}
                      className="text-white hover:bg-zinc-700"
                    >
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Approval Date</label>
              <Input
                value={approvalDate}
                onChange={(e) => setApprovalDate(e.target.value)}
                placeholder="e.g. 2019-07"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { reset(); onClose(); }}
              className="text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !name || !genericName || !therapeuticArea || !indication}
            >
              {loading ? "Adding..." : "Add Drug"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Trigger button that manages open state — used in various places
export function AddDrugButton({
  companyId,
  label = "Add Drug",
}: {
  companyId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" />
        {label}
      </Button>
      <AddDrugDialog
        companyId={companyId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
