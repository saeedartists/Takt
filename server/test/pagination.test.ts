import { describe, expect, it, vi } from 'vitest';
import type { FhirClient } from '../src/fhir.js';
import { searchAll } from '../src/fhir-queries.js';
import type { FhirBundle, FhirResource } from '../src/domain/types.js';

const resource = (id: string): FhirResource => ({ resourceType: 'Patient', id });

const bundle = (
  resources: FhirResource[],
  options: { total?: number; next?: string } = {},
): FhirBundle<FhirResource> => ({
  resourceType: 'Bundle',
  total: options.total ?? resources.length,
  entry: resources.map((item) => ({ resource: item })),
  ...(options.next ? { link: [{ relation: 'next', url: options.next }] } : {}),
});

describe('searchAll', () => {
  it('follows next links instead of relying on offsets', async () => {
    const search = vi.fn(async () =>
      bundle([resource('p-1')], { total: 2, next: 'https://api.test/fhir/R4/Patient?page=2' }),
    );
    const searchNext = vi.fn(async () => bundle([resource('p-2')], { total: 2 }));
    const fhir = { search, searchNext } as unknown as FhirClient;

    const results = await searchAll(fhir, 'Patient', {}, 200);
    expect(results.map((item) => item.id)).toEqual(['p-1', 'p-2']);
    expect(search).toHaveBeenCalledTimes(1);
    expect(searchNext).toHaveBeenCalledTimes(1);
  });

  it('continues by offset when the server caps the page size but reports a total', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce(bundle([resource('p-1')], { total: 2 }))
      .mockResolvedValueOnce(bundle([resource('p-2')], { total: 2 }));
    const fhir = { search } as unknown as FhirClient;

    const results = await searchAll(fhir, 'Patient', {}, 200);
    expect(results.map((item) => item.id)).toEqual(['p-1', 'p-2']);
    expect(search).toHaveBeenNthCalledWith(
      2,
      'Patient',
      expect.objectContaining({ _offset: 1 }),
    );
  });

  it('throws rather than silently truncating at the safety limit', async () => {
    const search = vi.fn(async () => bundle([resource('p-1')], { total: 2 }));
    const fhir = { search } as unknown as FhirClient;
    await expect(searchAll(fhir, 'Patient', {}, 200, 1)).rejects.toThrow(/safety limit/);
  });

  it('rejects a repeating next link', async () => {
    const next = 'https://api.test/fhir/R4/Patient?page=2';
    const search = vi.fn(async () => bundle([resource('p-1')], { total: 3, next }));
    const searchNext = vi.fn(async () => bundle([resource('p-1')], { total: 3, next }));
    const fhir = { search, searchNext } as unknown as FhirClient;
    await expect(searchAll(fhir, 'Patient', {}, 1)).rejects.toThrow(/repeating next link/);
  });
});
