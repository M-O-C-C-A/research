"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReportViewerProps {
  content: string;
}

export function ReportViewer({ content }: ReportViewerProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none
      prose-headings:text-white prose-headings:font-semibold
      prose-h1:text-xl prose-h1:mb-4 prose-h1:mt-0
      prose-h2:text-base prose-h2:text-zinc-200 prose-h2:border-b prose-h2:border-zinc-800 prose-h2:pb-2 prose-h2:mt-8 prose-h2:mb-4
      prose-h3:text-sm prose-h3:text-zinc-300 prose-h3:mt-6 prose-h3:mb-2
      prose-p:text-zinc-400 prose-p:leading-relaxed
      prose-li:text-zinc-400
      prose-strong:text-zinc-200 prose-strong:font-semibold
      prose-code:text-zinc-300 prose-code:bg-zinc-800 prose-code:px-1 prose-code:rounded
      prose-table:text-sm
      prose-th:text-zinc-300 prose-th:font-semibold prose-th:border prose-th:border-zinc-700 prose-th:px-3 prose-th:py-2
      prose-td:text-zinc-400 prose-td:border prose-td:border-zinc-800 prose-td:px-3 prose-td:py-2
      prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
