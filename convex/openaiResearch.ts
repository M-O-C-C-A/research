"use node";

import OpenAI from "openai";

export const RESEARCH_MODEL = "gpt-4.1";
const DEFAULT_MAX_RETRIES = 1;

export interface ResearchSource {
  title: string;
  url: string;
}

export interface ResearchResponse<T> {
  data: T;
  requestId: string | null | undefined;
  retryCount: number;
  sources: ResearchSource[];
  text: string;
}

interface BaseResponseOptions {
  instructions: string;
  input: string;
  maxOutputTokens: number;
  maxRetries?: number;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => Promise<void>;
}

interface StructuredResponseOptions extends BaseResponseOptions {
  formatName: string;
  schema: Record<string, unknown>;
  searchContextSize?: "low" | "medium" | "high";
  allowedDomains?: string[];
  maxToolCalls?: number;
}

interface TextResponseOptions extends BaseResponseOptions {
  searchContextSize?: "low" | "medium" | "high";
  allowedDomains?: string[];
  maxToolCalls?: number;
}

export function createResearchClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

export async function createStructuredWebSearchResponse<T>(
  client: OpenAI,
  options: StructuredResponseOptions
): Promise<ResearchResponse<T>> {
  const { response, retryCount } = await createWithRetry(
    client,
    options,
    true,
    true
  );
  const text = getOutputText(response);

  return {
    data: JSON.parse(text) as T,
    requestId: response._request_id,
    retryCount,
    sources: extractSources(response),
    text,
  };
}

export async function createWebSearchTextResponse(
  client: OpenAI,
  options: TextResponseOptions
): Promise<ResearchResponse<string>> {
  const { response, retryCount } = await createWithRetry(
    client,
    options,
    false,
    true
  );
  const text = getOutputText(response);

  return {
    data: text,
    requestId: response._request_id,
    retryCount,
    sources: extractSources(response),
    text,
  };
}

export async function createTextResponse(
  client: OpenAI,
  options: BaseResponseOptions
): Promise<ResearchResponse<string>> {
  const { response, retryCount } = await createWithRetry(
    client,
    options,
    false,
    false
  );
  const text = getOutputText(response);

  return {
    data: text,
    requestId: response._request_id,
    retryCount,
    sources: [],
    text,
  };
}

function buildWebSearchTool(
  options: Pick<TextResponseOptions, "searchContextSize" | "allowedDomains">
) {
  return {
    type: "web_search_preview" as const,
    search_context_size: options.searchContextSize ?? "medium",
    ...(options.allowedDomains?.length
      ? {
          filters: {
            allowed_domains: options.allowedDomains,
          },
        }
      : {}),
    user_location: {
      type: "approximate" as const,
      country: "DE",
      timezone: "Europe/Berlin",
    },
  };
}

async function createWithRetry(
  client: OpenAI,
  options: StructuredResponseOptions | TextResponseOptions,
  structured: boolean,
  withWebSearch: boolean
) {
  let attempt = 0;

  while (true) {
    try {
      const response = await client.responses.create({
        model: RESEARCH_MODEL,
        instructions: options.instructions,
        input: options.input,
        max_output_tokens: options.maxOutputTokens,
        ...(withWebSearch
          ? {
              max_tool_calls: (options as TextResponseOptions).maxToolCalls ?? 6,
              tools: [buildWebSearchTool(options)],
              include: ["web_search_call.action.sources" as const],
            }
          : {}),
        ...(structured
          ? {
              text: {
                format: {
                  type: "json_schema" as const,
                  name: (options as StructuredResponseOptions).formatName,
                  schema: (options as StructuredResponseOptions).schema,
                  strict: true,
                },
              },
            }
          : {}),
      });

      return { response, retryCount: attempt };
    } catch (error) {
      const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
      if (!isRetryableRateLimit(error) || attempt >= maxRetries) {
        throw error;
      }

      attempt += 1;
      const delayMs = 1500 * attempt;
      await options.onRetry?.(attempt, delayMs, error);
      await sleep(delayMs);
    }
  }
}

function isRetryableRateLimit(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as {
    status?: number;
    code?: string;
    message?: string;
  };

  return (
    maybeError.status === 429 ||
    maybeError.code === "rate_limit_exceeded" ||
    maybeError.message?.includes("429") === true
  );
}

function getOutputText(response: { output_text?: string; output?: unknown[] }): string {
  if (response.output_text?.trim()) {
    return response.output_text;
  }

  const parts: string[] = [];

  for (const item of response.output ?? []) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown[] }).content;
    if (!Array.isArray(content)) continue;

    for (const chunk of content) {
      if (!chunk || typeof chunk !== "object") continue;
      const typedChunk = chunk as { type?: string; text?: string };
      if (typedChunk.type === "output_text" && typedChunk.text) {
        parts.push(typedChunk.text);
      }
    }
  }

  const text = parts.join("").trim();
  if (!text) {
    throw new Error("OpenAI response did not include output text");
  }
  return text;
}

function extractSources(response: { output?: unknown[] }): ResearchSource[] {
  const byUrl = new Map<string, ResearchSource>();

  for (const item of response.output ?? []) {
    if (!item || typeof item !== "object") continue;

    const typedItem = item as {
      type?: string;
      action?: {
        sources?: Array<{ url?: string }>;
      };
    };

    if (typedItem.type !== "web_search_call") continue;

    for (const source of typedItem.action?.sources ?? []) {
      if (!source.url || byUrl.has(source.url)) continue;
      byUrl.set(source.url, {
        title: source.url,
        url: source.url,
      });
    }
  }

  return [...byUrl.values()];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
