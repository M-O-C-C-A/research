"use client";

import type { ChangeEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { uploadFileToConvex } from "@/lib/convexUpload";
import { extractPdfPreviewText } from "@/lib/pdfClient";

interface ResearchInputPanelProps {
  drugId: string;
}

function extractSeedTerms(text: string): string[] {
  const matches =
    text.match(
      /\b[A-Z][A-Za-z0-9&.-]{2,}(?:\s+[A-Z][A-Za-z0-9&.-]{2,}){0,2}\b/g
    ) ?? [];
  return [...new Set(matches.map((value) => value.trim()))].slice(0, 20);
}

export function ResearchInputPanel({ drugId }: ResearchInputPanelProps) {
  const researchInputs = useQuery(api.researchInputs.listByDrug, {
    drugId: drugId as Id<"drugs">,
  });
  const addResearchInput = useMutation(api.researchInputs.add);
  const removeResearchInput = useMutation(api.researchInputs.remove);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const processResearchInputUpload = useAction(api.ai.processResearchInputUpload);

  const [title, setTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [savingText, setSavingText] = useState(false);
  const [processingFile, setProcessingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasTextDraft = useMemo(
    () => title.trim().length > 0 && textContent.trim().length > 0,
    [title, textContent]
  );

  async function handleSaveText() {
    if (!hasTextDraft) return;

    setSavingText(true);
    setUploadError(null);
    try {
      await addResearchInput({
        drugId: drugId as Id<"drugs">,
        title: title.trim(),
        sourceType: "text",
        content: textContent.trim().slice(0, 12000),
        seedTerms: extractSeedTerms(textContent),
      });
      setTitle("");
      setTextContent("");
    } finally {
      setSavingText(false);
    }
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
      await processResearchInputUpload({
        drugId: drugId as Id<"drugs">,
        title: file.name,
        sourceType,
        storageId: storageId as Id<"_storage">,
        fileName: file.name,
        contentType: file.type || undefined,
        extractedText,
      });
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "The upload could not be processed."
      );
    } finally {
      setProcessingFile(false);
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
            Research Inputs
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Upload PDFs, screenshots, or notes with company names and product
            clues. They will be used as search seed context for deeper internet
            research.
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
          Upload PDF or Image
        </Button>
      </div>

      {uploadError && (
        <p className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {uploadError}
        </p>
      )}

      <div className="mb-4 grid gap-3">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Quick note title, e.g. KEMEDICA target list"
          className="border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-600"
        />
        <Textarea
          value={textContent}
          onChange={(event) => setTextContent(event.target.value)}
          placeholder="Paste company names, distributor notes, excerpts from directories, or commercial hypotheses..."
          rows={4}
          className="resize-none border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-600"
        />
        <div className="flex justify-end">
          <Button onClick={handleSaveText} disabled={!hasTextDraft || savingText}>
            {savingText ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Save Note
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {(researchInputs ?? []).length === 0 ? (
          <p className="text-sm text-zinc-600">No research inputs attached yet.</p>
        ) : (
          researchInputs?.map((input) => (
            <div
              key={input._id}
              className="flex items-start justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-3"
            >
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  {input.sourceType === "image" ? (
                    <ImagePlus className="h-4 w-4 text-zinc-500" />
                  ) : (
                    <FileText className="h-4 w-4 text-zinc-500" />
                  )}
                  <p className="truncate text-sm font-medium text-zinc-200">
                    {input.title}
                  </p>
                </div>
                <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">
                  {input.sourceType}
                </p>
                <p className="line-clamp-3 text-sm text-zinc-400">
                  {input.content}
                </p>
                {input.seedTerms.length > 0 && (
                  <p className="mt-2 line-clamp-2 text-xs text-zinc-600">
                    Seeds: {input.seedTerms.join(", ")}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-zinc-600 hover:text-red-400"
                onClick={() => removeResearchInput({ id: input._id })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
