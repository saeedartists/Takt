import type { ServerConfig } from './config.js';
import { HttpFhirClient, type FhirClient, type TokenProvider } from './fhir.js';

export const staticTokenProvider = (token: string): TokenProvider => () => token;

export class OvokAuthError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'OvokAuthError';
  }
}

export type ClientCredentialsOptions = {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  tenantCode?: string;
  scope?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number | string;
  token_type?: string;
};

export const clientCredentialsTokenProvider = (options: ClientCredentialsOptions): TokenProvider => {
  let cached: { token: string; expiresAt: number } | undefined;
  let inFlight: Promise<string> | undefined;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  const fetchToken = async (): Promise<string> => {
    const now = Date.now();
    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('client_id', options.clientId);
    body.set('client_secret', options.clientSecret);
    if (options.tenantCode) body.set('tenant_code', options.tenantCode);
    if (options.scope) body.set('scope', options.scope);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(options.tokenUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      throw new OvokAuthError(
        controller.signal.aborted ? 'Ovok token request timed out.' : 'Ovok token request failed.',
        undefined,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let detail = '';
      try {
        const payload = JSON.parse(text) as { error?: string; error_description?: string };
        detail = payload.error_description ?? payload.error ?? '';
      } catch {
        detail = text.slice(0, 200);
      }
      throw new OvokAuthError(
        `Ovok token request failed: ${response.status.toString()}${detail ? ` (${detail})` : ''}`,
        response.status,
      );
    }

    let payload: TokenResponse;
    try {
      payload = (await response.json()) as TokenResponse;
    } catch {
      throw new OvokAuthError('Ovok token response was not valid JSON.');
    }
    if (!payload.access_token) throw new OvokAuthError('Ovok token response is missing access_token.');

    const expiresIn = Number(payload.expires_in ?? 3600);
    const lifetimeMs = (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000;
    cached = {
      token: payload.access_token,
      expiresAt: now + lifetimeMs,
    };
    return cached.token;
  };

  return async () => {
    if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
    if (!inFlight) {
      inFlight = fetchToken().finally(() => {
        inFlight = undefined;
      });
    }
    return inFlight;
  };
};

export const createOvokFhirClient = (
  config: ServerConfig,
  fetchImpl: typeof fetch = fetch,
): FhirClient => {
  const common = {
    baseUrl: config.OVOK_API_URL,
    tenantCode: config.OVOK_TENANT_CODE,
    fetchImpl,
    timeoutMs: config.OVOK_REQUEST_TIMEOUT_MS,
    maxRetries: config.OVOK_MAX_RETRIES,
  };

  if (config.OVOK_ACCESS_TOKEN) {
    return new HttpFhirClient({
      ...common,
      token: staticTokenProvider(config.OVOK_ACCESS_TOKEN),
    });
  }

  if (!config.OVOK_CLIENT_ID || !config.OVOK_CLIENT_SECRET || !config.OVOK_TOKEN_URL) {
    throw new Error(
      'Set OVOK_ACCESS_TOKEN or OVOK_CLIENT_ID + OVOK_CLIENT_SECRET + OVOK_TOKEN_URL to use the Ovok FHIR API.',
    );
  }

  return new HttpFhirClient({
    ...common,
    token: clientCredentialsTokenProvider({
      tokenUrl: config.OVOK_TOKEN_URL,
      clientId: config.OVOK_CLIENT_ID,
      clientSecret: config.OVOK_CLIENT_SECRET,
      tenantCode: config.OVOK_TENANT_CODE,
      scope: config.OVOK_SCOPE,
      fetchImpl,
      timeoutMs: config.OVOK_REQUEST_TIMEOUT_MS,
    }),
  });
};
