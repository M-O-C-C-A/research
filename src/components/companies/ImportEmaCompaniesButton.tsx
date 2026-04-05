"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";

export function ImportEmaCompaniesButton() {
  const importEmaSmeCompanies = useAction(api.companyImportActions.importEmaSmeCompanies);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await importEmaSmeCompanies({});
      setMessage(
        `Imported ${result.totalFound} EMA SME companies across ${result.pageCount} pages. Added ${result.createdCount} new records and refreshed ${result.updatedCount} existing ones.`
      );
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "EMA SME companies could not be imported."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={handleImport} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Building2 className="mr-2 h-4 w-4" />
        )}
        {loading ? "Importing EMA companies..." : "Import EMA SME companies"}
      </Button>
      {message ? <p className="text-xs text-zinc-400">{message}</p> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
