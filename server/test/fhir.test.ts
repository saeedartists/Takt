import { describe, expect, it, vi } from 'vitest';
import { FhirNetworkError, HttpFhirClient } from '../src/fhir.js';

describe('HttpFhirClient', () => {
  it('adds tenant and authorization headers and searches with typed params', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ resourceType: 'Bundle', entry: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/fhir+json' },
      }),
    );
    const fetchImpl = fetchMock as unknown as typeof fetch;

    const client = new HttpFhirClient({
      baseUrl: 'https://api.ovok.test',
      tenantCode: 'takt-test',
      token: () => 'token-123',
      fetchImpl,
    });

    await client.search('MedicationRequest', { subject: 'Patient/p-1', _count: 10 });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.ovok.test/fhir/R4/MedicationRequest?subject=Patient%2Fp-1&_count=10');
    expect(init.headers).toBeInstanceOf(Headers);
    const headers = init.headers as Headers;
    expect(headers.get('x-tenant-code')).toBe('takt-test');
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(headers.get('Accept')).toBe('application/fhir+json');
  });

  it('surfaces OperationOutcome diagnostics', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          resourceType: 'OperationOutcome',
          issue: [{ diagnostics: 'Registration is not enabled for this project' }],
        }),
        { status: 403 },
      ),
    ) as unknown as typeof fetch;

    const client = new HttpFhirClient({
      baseUrl: 'https://api.ovok.test',
      tenantCode: 'takt-test',
      token: () => 'token-123',
      fetchImpl,
    });

    await expect(client.read('Patient/p-1')).rejects.toThrow(
      'Registration is not enabled for this project',
    );
  });

  it('retries a transient GET failure with backoff', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ resourceType: 'Patient', id: 'p-1' }), { status: 200 }),
      ) as unknown as typeof fetch;

    const client = new HttpFhirClient({
      baseUrl: 'https://api.ovok.test',
      tenantCode: 'takt-test',
      token: () => 'token-123',
      fetchImpl: fetchMock,
      maxRetries: 1,
      retryBaseMs: 1,
    });

    await expect(client.read('Patient/p-1')).resolves.toMatchObject({ id: 'p-1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-idempotent writes', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    const client = new HttpFhirClient({
      baseUrl: 'https://api.ovok.test',
      tenantCode: 'takt-test',
      token: () => 'token-123',
      fetchImpl: fetchMock,
      maxRetries: 3,
      retryBaseMs: 1,
    });

    await expect(
      client.create({ resourceType: 'Communication', id: 'c-1' }),
    ).rejects.toThrow('503');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts requests that exceed the timeout', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ) as unknown as typeof fetch;

    const client = new HttpFhirClient({
      baseUrl: 'https://api.ovok.test',
      tenantCode: 'takt-test',
      token: () => 'token-123',
      fetchImpl,
      timeoutMs: 5,
      maxRetries: 0,
    });

    await expect(client.read('Patient/p-1')).rejects.toBeInstanceOf(FhirNetworkError);
  });

  it('sends a conditional create header without retrying the write', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ resourceType: 'Communication', id: 'c-1' }), { status: 201 }),
    );
    const client = new HttpFhirClient({
      baseUrl: 'https://api.ovok.test',
      tenantCode: 'takt-test',
      token: () => 'token-123',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await client.create(
      { resourceType: 'Communication' },
      { ifNoneExist: 'identifier=system|value' },
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Headers).get('If-None-Exist')).toBe('identifier=system|value');
  });

  it('rejects next links outside the configured FHIR origin', async () => {
    const client = new HttpFhirClient({
      baseUrl: 'https://api.ovok.test',
      tenantCode: 'takt-test',
      token: () => 'token-123',
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    await expect(client.searchNext('https://evil.test/fhir/R4/Patient')).rejects.toThrow(
      'FHIR next link',
    );
  });
});
