/**
 * OpenAI-compatible chat completions.
 *
 * The endpoint is configurable because the ecosystem is not one vendor: any
 * server speaking `/chat/completions` works (OpenAI, OpenRouter, DeepSeek,
 * Qwen, a local Ollama or llama.cpp listener, and GitHub Models while it lasts).
 * Credentials stay in the environment so a key never enters a config file.
 */

import { fetchJson } from "./http.js";

/** Fallback used when neither an input nor OPENAI_API_BASE is given. */
export const DEFAULT_CHAT_BASE_URL = "https://api.openai.com/v1";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model: string;
  messages: readonly ChatMessage[];
  /** Overrides OPENAI_API_BASE, which overrides the default. */
  baseURL?: string | undefined;
  temperature?: number | undefined;
  timeoutMs?: number | undefined;
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

/**
 * Build the chat-completions URL.
 *
 * Precedence: explicit argument, then OPENAI_API_BASE, then OpenAI. Trailing
 * slashes are removed so a pasted "https://x/v1/" behaves like "https://x/v1".
 */
export function resolveChatUrl(baseURL: string | undefined): string {
  const fromEnv = process.env.OPENAI_API_BASE;
  const raw = baseURL ?? fromEnv ?? DEFAULT_CHAT_BASE_URL;
  const base = raw.trim().replace(/\/+$/, "");
  if (base === "") {
    throw new Error("resolved chat base URL is empty");
  }
  return `${base}/chat/completions`;
}

/** Send a chat completion and return the assistant text. */
export async function chatCompletion(options: ChatOptions): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    throw new Error(
      "OPENAI_API_KEY is not set (any sender works against an OpenAI-compatible endpoint; leave it as a placeholder for self-hosted servers that skip auth)",
    );
  }

  const url = resolveChatUrl(options.baseURL);
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;

  const response = await fetchJson<ChatResponse>(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    options.timeoutMs,
  );

  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(
      `no assistant content in response from ${url}: ${JSON.stringify(response).slice(0, 300)}`,
    );
  }
  return content.trim();
}
