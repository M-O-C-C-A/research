"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EUROPEAN_COUNTRIES, THERAPEUTIC_AREAS } from "@/lib/constants";
import { Plus, X } from "lucide-react";

interface AddCompanyDialogProps {
  trigger?: React.ReactNode;
}

export function AddCompanyDialog({ trigger }: AddCompanyDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const createCompany = useMutation(api.companies.create);

  function toggleArea(area: string) {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !country) return;
    setLoading(true);
    try {
      await createCompany({
        name,
        country,
        website: website || undefined,
        description: description || undefined,
        therapeuticAreas: selectedAreas,
      });
      setOpen(false);
      setName("");
      setCountry("");
      setWebsite("");
      setDescription("");
      setSelectedAreas([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger render={<Button size="sm" />}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Company
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Add Company</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Company Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bayer AG"
              required
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Country *</label>
            <Select value={country} onValueChange={(v) => setCountry(v ?? "")}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {EUROPEAN_COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-white hover:bg-zinc-700">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Website</label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              type="url"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the company..."
              rows={2}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">Therapeutic Areas</label>
            <div className="flex flex-wrap gap-2">
              {THERAPEUTIC_AREAS.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedAreas.includes(area)
                      ? "bg-white text-zinc-900"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                  }`}
                >
                  {selectedAreas.includes(area) && <X className="h-2.5 w-2.5" />}
                  {area}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-zinc-400"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading || !name || !country}>
              {loading ? "Adding..." : "Add Company"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
