import { randomUUID } from 'node:crypto';
import type { FhirBundle, FhirResource } from './domain/types.js';

export type SearchParams = Record<string, string | number | boolean | undefined>;

export type FhirClient = {
  read<T extends FhirResource>(path: string): Promise<T>;
  search<T extends FhirResource>(resourceType: string, params?: SearchParams): Promise<FhirBundle<T>>;
  searchNext?<T extends FhirResource>(url: string): Promise<FhirBundle<T>>;
  create<T extends FhirResource>(resource: T, options?: CreateOptions): Promise<T>;
  update<T extends FhirResource>(resource: T): Promise<T>;
  delete(path: string): Promise<void>;
};

export type TokenProvider = () => string | Promise<string>;

export type CreateOptions = {
  ifNoneExist?: string;
};

export class FhirHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: unknown,
    message?: string,
    public readonly requestId?: string,
  ) {
    super(message ?? `FHIR request failed: ${status.toString()} ${path}`);
    this.name = 'FhirHttpError';
  }
}

export class FhirNetworkError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly requestId?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'FhirNetworkError';
  }
}

type OperationOutcomeBody = {
  resourceType?: string;
  issue?: {
    diagnostics?: string;
    details?: { text?: string };
  }[];
};

const operationOutcomeText = (body: unknown): string | undefined => {
  if (!body || typeof body !== 'object') return undefined;
  const outcome = body as OperationOutcomeBody;
  if (outcome.resourceType !== 'OperationOutcome') return undefined;
  const pieces = (outcome.issue ?? [])
    .map((issue) => issue.diagnostics ?? issue.details?.text)
    .filter((piece): piece is string => Boolean(piece?.trim()));
  return pieces.length > 0 ? pieces.join(' · ') : undefined;
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const retryAfterMilliseconds = (response: Response): number | undefined => {
  const header = response.headers.get('retry-after');
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return Math.min(seconds * 1000, 30_000);
};

export type HttpFhirClientOptions = {
  baseUrl: string;
  tenantCode: string;
  token: TokenProvider;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  userAgent?: string;
};

export class HttpFhirClient implements FhirClient {
  private readonly baseUrl: string;
  private readonly base: URL;
  private readonly basePathPrefix: string;
  private readonly tenantCode: string;
  private readonly token: TokenProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly userAgent: string;

  constructor(options: HttpFhirClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.base = new URL(this.baseUrl);
    this.basePathPrefix = this.base.pathname.replace(/\/+$/, '');
    this.tenantCode = options.tenantCode;
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseMs = options.retryBaseMs ?? 1000;
    this.userAgent = options.userAgent ?? 'Takt-Server/0.1';
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const method = (init?.method ?? 'GET').toUpperCase();
    const retryable = method === 'GET' || method === 'HEAD' || method === 'PUT' || method === 'DELETE';
    const maxAttempts = retryable ? this.maxRetries + 1 : 1;
    let lastNetworkError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const requestId = randomUUID();
      const headers = new Headers(init?.headers);
      headers.set('Accept', 'application/fhir+json');
      headers.set('x-tenant-code', this.tenantCode);
      headers.set('Authorization', `Bearer ${await this.token()}`);
      headers.set('User-Agent', this.userAgent);
      headers.set('X-Request-Id', requestId);
      if (init?.body) headers.set('Content-Type', 'application/fhir+json');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const externalAbort = (): void => controller.abort();
      if (init?.signal?.aborted) controller.abort();
      else init?.signal?.addEventListener('abort', externalAbort, { once: true });

      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          ...init,
          headers,
          signal: controller.signal,
        });
      } catch (error) {
        lastNetworkError = error;
        if (attempt + 1 < maxAttempts) {
          await sleep(this.backoff(attempt));
          continue;
        }
        const aborted = controller.signal.aborted;
        throw new FhirNetworkError(
          aborted ? `FHIR request timed out after ${this.timeoutMs.toString()}ms` : 'FHIR network request failed',
          path,
          requestId,
          { cause: error },
        );
      } finally {
        clearTimeout(timeout);
        init?.signal?.removeEventListener('abort', externalAbort);
      }

      if (!response.ok) {
        const body = await this.readErrorBody(response);
        if (attempt + 1 < maxAttempts && (response.status === 429 || response.status >= 500)) {
          await sleep(retryAfterMilliseconds(response) ?? this.backoff(attempt));
          continue;
        }
        throw new FhirHttpError(
          response.status,
          path,
          body,
          operationOutcomeText(body),
          requestId,
        );
      }

      if (response.status === 204) return undefined as T;
      try {
        return (await response.json()) as T;
      } catch (error) {
        throw new FhirNetworkError('FHIR response was not valid JSON', path, requestId, { cause: error });
      }
    }

    throw new FhirNetworkError('FHIR request failed after retries', path, undefined, {
      cause: lastNetworkError,
    });
  }

  private backoff(attempt: number): number {
    return Math.min(this.retryBaseMs * 2 ** attempt, 5000) + Math.floor(Math.random() * 250);
  }

  private async readErrorBody(response: Response): Promise<unknown> {
    const text = await response.text().catch(() => '');
    if (!text) return undefined;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  async read<T extends FhirResource>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async search<T extends FhirResource>(resourceType: string, params: SearchParams = {}): Promise<FhirBundle<T>> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      query.set(key, String(value));
    }
    const suffix = query.toString();
    return this.request<FhirBundle<T>>(`/fhir/R4/${resourceType}${suffix ? `?${suffix}` : ''}`);
  }

  async searchNext<T extends FhirResource>(url: string): Promise<FhirBundle<T>> {
    let resolved: URL;
    try {
      resolved = new URL(url);
    } catch {
      throw new Error('Refusing to follow a non-absolute FHIR next link.');
    }
    if (resolved.origin !== this.base.origin) {
      throw new Error('Refusing to follow a FHIR next link to another origin.');
    }
    const allowedPrefix = `${this.basePathPrefix}/fhir/R4/`;
    if (!resolved.pathname.startsWith(allowedPrefix)) {
      throw new Error('Refusing to follow a FHIR next link outside the FHIR endpoint.');
    }
    const relativePath = resolved.pathname.slice(this.basePathPrefix.length);
    return this.request<FhirBundle<T>>(`${relativePath}${resolved.search}`);
  }

  async create<T extends FhirResource>(resource: T, options: CreateOptions = {}): Promise<T> {
    return this.request<T>(`/fhir/R4/${resource.resourceType}`, {
      method: 'POST',
      body: JSON.stringify(resource),
      headers: options.ifNoneExist ? { 'If-None-Exist': options.ifNoneExist } : undefined,
    });
  }

  async update<T extends FhirResource>(resource: T): Promise<T> {
    if (!resource.id) throw new Error(`${resource.resourceType} update requires an id.`);
    return this.request<T>(`/fhir/R4/${resource.resourceType}/${resource.id}`, {
      method: 'PUT',
      body: JSON.stringify(resource),
    });
  }

  async delete(path: string): Promise<void> {
    await this.request<void>(path, { method: 'DELETE' });
  }
}
