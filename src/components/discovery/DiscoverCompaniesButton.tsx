"use client";

import type { ChangeEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  ImagePlus,
  Loader2,
  Radar,
  Trash2,
  Upload,
} from "lucide-react";
import { uploadFileToConvex } from "@/lib/convexUpload";
import { extractPdfPreviewText } from "@/lib/pdfClient";

interface DiscoverCompaniesButtonProps {
  size?: "sm" | "default";
  variant?: "default" | "outline";
  onJobStarted?: (jobId: string) => void;
  label?: string;
}

interface DiscoveryContextItem {
  title: string;
  sourceType: "pdf" | "image" | "text";
  content: string;
  seedTerms: string[];
}

function extractSeedTerms(text: string): string[] {
  const matches =
    text.match(
      /\b[A-Z][A-Za-z0-9&.-]{2,}(?:\s+[A-Z][A-Za-z0-9&.-]{2,}){0,2}\b/g
    ) ?? [];
  return [...new Set(matches.map((value) => value.trim()))].slice(0, 20);
}

export function DiscoverCompaniesButton({
  size = "default",
  variant = "default",
  onJobStarted,
  label = "Discover Manufacturers",
}: DiscoverCompaniesButtonProps) {
  const findCompanies = useAction(api.discovery.findCompanies);
  const processCompanyDiscoveryUpload = useAction(
    api.discovery.processCompanyDiscoveryUpload
  );
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const [loading, setLoading] = useState(false);
  const [processingFile, setProcessingFile] = useState(false);
  const [open, setOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [contextItems, setContextItems] = useState<DiscoveryContextItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSaveNote = useMemo(
    () => noteTitle.trim().length > 0 && noteText.trim().length > 0,
    [noteTitle, noteText]
  );

  async function startDiscovery(useContext: boolean) {
    setLoading(true);
    setUploadError(null);
    try {
      const jobId = await findCompanies(
        useContext
          ? {
              researchContext: contextItems
                .map(
                  (item, index) =>
                    `Input ${index + 1}: ${item.title} (${item.sourceType})\n${item.content}`
                )
                .join("\n\n---\n\n"),
              seedTerms: [...new Set(contextItems.flatMap((item) => item.seedTerms))].slice(
                0,
                20
              ),
            }
          : {}
      );
      onJobStarted?.(jobId);
      setLastJobId(jobId);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function addNote() {
    if (!canSaveNote) return;
    setUploadError(null);
    setContextItems((current) => [
      {
        title: noteTitle.trim(),
        sourceType: "text",
        content: noteText.trim().slice(0, 12000),
        seedTerms: extractSeedTerms(noteText),
      },
      ...current,
    ]);
    setNoteTitle("");
    setNoteText("");
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProcessingFile(true);
    setUploadError(null);
    try {
      const sourceType =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
          ? "pdf"
          : file.type.startsWith("image/")
            ? "image"
            : null;

      if (!sourceType) {
        throw new Error("Please upload a PDF or image file.");
      }

      const { storageId } = await uploadFileToConvex(file, generateUploadUrl);
      const extractedText =
        sourceType === "pdf"
          ? await extractPdfPreviewText(file, { maxPages: 6, maxChars: 8000 })
          : undefined;
      const result = await processCompanyDiscoveryUpload({
        title: file.name,
        sourceType,
        storageId: storageId as Id<"_storage">,
        extractedText,
      });

      setContextItems((current) => [
        {
          title: result.title || file.name,
          sourceType: result.sourceType,
          content: result.content,
          seedTerms:
            result.seedTerms.length > 0
              ? result.seedTerms
              : extractSeedTerms(result.content),
        },
        ...current,
      ]);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "The upload could not be processed."
      );
    } finally {
      setProcessingFile(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <Button
          size={size}
          variant={variant}
          onClick={() => setOpen(true)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Radar className="mr-2 h-4 w-4" />
          )}
          {loading ? "Researching..." : label}
        </Button>
        {lastJobId && (
          <a
            href={`/discovery?job=${lastJobId}`}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            View latest research
          </a>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl border-zinc-800 bg-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Discover Manufacturers</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Run manufacturer discovery as is, or attach optional PDFs, screenshots,
              or notes to seed the search with smaller European targets and market-entry
              clues.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  Optional research inputs
                </p>
                <p className="text-sm text-zinc-500">
                  Use directories, screenshots, partner notes, or short lists of
                  target companies.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                className="sr-only"
                onChange={handleFileChange}
                disabled={processingFile}
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={processingFile}
              >
                {processingFile ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload
              </Button>
            </div>

            {uploadError && (
              <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {uploadError}
              </p>
            )}

            <div className="grid gap-3">
              <Input
                value={noteTitle}
                onChange={(event) => setNoteTitle(event.target.value)}
                placeholder="Quick note title"
                className="border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-600"
              />
              <Textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Paste company names, distributor notes, conference takeaways, or other discovery clues..."
                rows={4}
                className="resize-none border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-600"
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addNote}
                  disabled={!canSaveNote}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Add Note
                </Button>
              </div>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto">
              {contextItems.length === 0 ? (
                <div className="rounded-md border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-600">
                  No optional context added. You can still run discovery normally.
                </div>
              ) : (
                contextItems.map((item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    className="flex items-start justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        {item.sourceType === "image" ? (
                          <ImagePlus className="h-4 w-4 text-zinc-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-zinc-500" />
                        )}
                        <p className="truncate text-sm font-medium text-zinc-200">
                          {item.title}
                        </p>
                      </div>
                      <p className="mb-1 text-xs uppercase tracking-wider text-zinc-600">
                        {item.sourceType}
                      </p>
                      <p className="line-clamp-3 text-sm text-zinc-400">
                        {item.content}
                      </p>
                      {item.seedTerms.length > 0 && (
                        <p className="mt-2 line-clamp-2 text-xs text-zinc-600">
                          Seeds: {item.seedTerms.join(", ")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-zinc-600 hover:text-red-400"
                      onClick={() =>
                        setContextItems((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="border-zinc-800 bg-zinc-900">
            <Button
              variant="ghost"
              onClick={() => startDiscovery(false)}
              disabled={loading || processingFile}
            >
              Run As Is
            </Button>
            <Button
              onClick={() => startDiscovery(true)}
              disabled={loading || processingFile}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Radar className="mr-2 h-4 w-4" />
              )}
              Run With Context
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
