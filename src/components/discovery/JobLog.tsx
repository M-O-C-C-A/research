"use client";

import { cn } from "@/lib/utils";

interface LogEntry {
  timestamp: number;
  message: string;
  level: "info" | "success" | "warning" | "error";
}

const LEVEL_STYLES: Record<LogEntry["level"], string> = {
  info: "text-zinc-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-red-400",
};

const LEVEL_PREFIX: Record<LogEntry["level"], string> = {
  info: "·",
  success: "✓",
  warning: "⚠",
  error: "✗",
};

interface JobLogProps {
  log: LogEntry[];
  status: "running" | "completed" | "error";
}

export function JobLog({ log, status }: JobLogProps) {
  return (
    <div className="rounded-md bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs max-h-80 overflow-y-auto">
      {log.length === 0 ? (
        <span className="text-zinc-600">Waiting for output...</span>
      ) : (
        <div className="space-y-1">
          {log.map((entry, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-zinc-700 shrink-0 tabular-nums">
                {new Date(entry.timestamp).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span
                className={cn(
                  "shrink-0 w-3",
                  LEVEL_STYLES[entry.level]
                )}
              >
                {LEVEL_PREFIX[entry.level]}
              </span>
              <span className={cn(LEVEL_STYLES[entry.level], "break-all")}>
                {entry.message}
              </span>
            </div>
          ))}
          {status === "running" && (
            <div className="flex gap-2 items-center mt-2">
              <span className="text-zinc-700 shrink-0">
                {new Date().toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="text-zinc-500 animate-pulse">▋</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
