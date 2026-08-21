import { env } from './env';
import { ovokClient } from './ovok-client';

/*
 * Mobile ovok-fetch — attaches the current Medplum/Ovok access token
 * from OvokClient storage and refreshes if it is near expiry.
 */

export type OvokFetchOptions = RequestInit & {
  ifMatch?: string;
  throwOnError?: boolean;
};

export class OvokFetchError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'OvokFetchError';
  }
}

export async function ovokFetch<T = unknown>(
  path: string,
  options: OvokFetchOptions = {},
): Promise<T> {
  const { ifMatch, throwOnError = true, headers, ...rest } = options;
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
  if (env.ovokTenantCode) finalHeaders['x-tenant-code'] = env.ovokTenantCode;

  const res = await fetch(url, { ...rest, headers: finalHeaders });
  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;

  if (!res.ok && throwOnError) {
    throw new OvokFetchError(
      res.status,
      path,
      body,
      `Ovok ${res.status.toString()} ${res.statusText} at ${path}`,
    );
  }

  return body as T;
}

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};
