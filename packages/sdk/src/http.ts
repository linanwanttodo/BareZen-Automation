/**
 * HTTP helpers for plugins.
 *
 * A plugin that calls `fetch` without a deadline can sit on a socket until the
 * step is killed, which wastes the whole run. Every outbound request gets a
 * bounded lifetime instead.
 */

/** Default per-request timeout, overridable with BAREZEN_HTTP_TIMEOUT (ms). */
export const DEFAULT_HTTP_TIMEOUT_MS: number = (() => {
  const raw = process.env.BAREZEN_HTTP_TIMEOUT;
  if (raw === undefined || raw.trim() === "") return 30_000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
})();

/** `fetch` with an abort deadline applied on top of any existing signal. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_HTTP_TIMEOUT_MS,
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/** Fetch and parse JSON, throwing with a bounded body snippet on non-2xx. */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_HTTP_TIMEOUT_MS,
): Promise<T> {
  const response = await fetchWithTimeout(url, init, timeoutMs);
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }
  return (await response.json()) as T;
}
