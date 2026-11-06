import { env } from './env';
import { ovokClient } from './ovok-client';

/*
 * Mobile ovok-fetch — attaches the current Medplum/Ovok access token
 * from OvokClient storage and refreshes if it is near expiry.
 */

export type OvokFetchOptions = RequestInit & {
  ifMatch?: string;
  throwOnError?: boolean;
  timeoutMs?: number;
  retries?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class OvokFetchError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: unknown,
    message: string,
    /** Milliseconds the server asked callers to wait (Retry-After header). */
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'OvokFetchError';
  }
}

/** Retry-After in seconds, or an HTTP date string. */
const parseRetryAfterMs = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
};

/** Beyond this, dose and consent times written from the device clock are suspect. */
export const CLOCK_SKEW_WARN_MS = 5 * 60_000;

/** Server time minus device time, from a response `Date` header (second precision). */
export const skewFromDateHeader = (header: string | null, nowMs: number): number | undefined => {
  if (!header) return undefined;
  const serverMs = Date.parse(header);
  return Number.isFinite(serverMs) ? serverMs - nowMs : undefined;
};

// ponytail: module-level, last response wins; read on render (queries re-render after load).
// On web the Date header is not CORS-exposed, so the skew stays 0 there.
let lastClockSkewMs = 0;
export const getClockSkewMs = (): number => lastClockSkewMs;

export async function ovokFetch<T = unknown>(
  path: string,
  options: OvokFetchOptions = {},
): Promise<T> {
  const { ifMatch, throwOnError = true, headers, timeoutMs: _t, retries: _r, ...rest } = options;
  const url = `${env.ovokApiUrl}${path}`;

  try {
    await ovokClient.refreshIfExpired(60);
  } catch {
    // Best-effort refresh. If refresh fails, request may still succeed
    // for public endpoints or return a meaningful 401/403.
  }

  const token = ovokClient.getAccessToken();
  const finalHeaders: Record<string, string> = {
    'content-type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (token) finalHeaders.authorization = `Bearer ${token}`;
  if (ifMatch) finalHeaders['if-match'] = ifMatch;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = Math.min(options.retries ?? MAX_RETRIES, MAX_RETRIES);
  // A POST that timed out or got a 5xx may already be saved; resending it
  // duplicates the resource. Only a conditional create (If-None-Exist) is safe.
  const method = (rest.method ?? 'GET').toUpperCase();
  const idempotent =
    (method !== 'POST' && method !== 'PATCH') ||
    Object.keys(finalHeaders).some((key) => key.toLowerCase() === 'if-none-exist');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { ...rest, headers: finalHeaders, signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      if (idempotent && attempt < maxRetries) {
        await sleep(Math.min(1000 * 2 ** attempt, 8000));
        continue;
      }
      throw err;
    }
    clearTimeout(timer);
    const skew = skewFromDateHeader(res.headers.get('date'), Date.now());
    if (skew !== undefined) lastClockSkewMs = skew;
    const text = await res.text();
    const body: unknown = text ? safeJson(text) : null;

    if (!res.ok && throwOnError) {
      const retryAfter = parseRetryAfterMs(res.headers.get('retry-after'));
      // 429 means the server refused before doing anything, so even a plain POST may retry it.
      const retryable = res.status === 429 || (idempotent && RETRYABLE_STATUSES.has(res.status));
      if (attempt < maxRetries && retryable) {
        await sleep(Math.min(retryAfter ?? 1000 * 2 ** attempt, 30_000));
        continue;
      }
      throw new OvokFetchError(
        res.status,
        path,
        body,
        `Ovok ${res.status.toString()} ${res.statusText} at ${path}`,
        retryAfter,
      );
    }

    return body as T;
  }
  throw new Error(`ovokFetch failed after ${maxRetries + 1} attempts at ${path}`);
}

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};
