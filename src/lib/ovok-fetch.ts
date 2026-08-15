import AsyncStorage from '@react-native-async-storage/async-storage';
import { env } from './env';

/*
 * Mobile ovok-fetch — differs from the web variant because RN doesn't
 * have credentialed cookie sessions in the same way. We store an
 * access token in AsyncStorage under 'ovok:access-token' and send it
 * as a Bearer header. The login screen (M3) writes to that key; sign
 * out clears it.
 *
 * If-Match optimistic concurrency is the same as web.
 */

const ACCESS_TOKEN_KEY = 'ovok:access-token';

export const setAccessToken = async (token: string | null): Promise<void> => {
  if (token) {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  }
};

export const getAccessToken = (): Promise<string | null> =>
  AsyncStorage.getItem(ACCESS_TOKEN_KEY);

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

  const token = await getAccessToken();
  const finalHeaders: Record<string, string> = {
    'content-type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (token) finalHeaders['authorization'] = `Bearer ${token}`;
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
