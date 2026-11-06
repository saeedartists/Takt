import { afterEach, describe, expect, it, vi } from 'vitest';

import { getClockSkewMs, ovokFetch, skewFromDateHeader } from './ovok-fetch';

// vi.mock is hoisted above the import by vitest.

vi.mock('./env', () => ({ env: { ovokApiUrl: 'https://ovok.test' } }));
vi.mock('./ovok-client', () => ({
  ovokClient: { refreshIfExpired: async () => undefined, getAccessToken: () => 'tok' },
}));

const respond = (status: number) => new Response(status < 300 ? '{"ok":true}' : '{}', { status });

const run = async (init: RequestInit, statuses: number[]) => {
  const fetchMock = vi.fn(async () => respond(statuses.shift() ?? 200));
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers();
  const result = ovokFetch('/fhir/R4/X', init).then(
    () => 'ok',
    () => 'error',
  );
  await vi.runAllTimersAsync();
  return { outcome: await result, calls: fetchMock.mock.calls.length };
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ovokFetch retries', () => {
  it('retries an idempotent GET on 503', async () => {
    expect(await run({ method: 'GET' }, [503, 200])).toEqual({ outcome: 'ok', calls: 2 });
  });

  it('never resends a plain POST after a 5xx (it may already be saved)', async () => {
    expect(await run({ method: 'POST', body: '{}' }, [503, 200])).toEqual({
      outcome: 'error',
      calls: 1,
    });
  });

  it('retries a conditional-create POST (If-None-Exist)', async () => {
    const init = { method: 'POST', body: '{}', headers: { 'If-None-Exist': 'identifier=a|b' } };
    expect(await run(init, [503, 201])).toEqual({ outcome: 'ok', calls: 2 });
  });

  it('retries a plain POST on 429 (refused before processing)', async () => {
    expect(await run({ method: 'POST', body: '{}' }, [429, 201])).toEqual({
      outcome: 'ok',
      calls: 2,
    });
  });

  it('does not retry a 4xx validation error', async () => {
    expect(await run({ method: 'PUT', body: '{}' }, [422])).toEqual({ outcome: 'error', calls: 1 });
  });
});

describe('clock skew (S-10)', () => {
  it('computes server minus device time from a Date header', () => {
    const now = Date.parse('2026-11-06T12:00:00Z');
    expect(skewFromDateHeader('Fri, 06 Nov 2026 12:10:00 GMT', now)).toBe(10 * 60_000);
    expect(skewFromDateHeader(null, now)).toBeUndefined();
    expect(skewFromDateHeader('garbage', now)).toBeUndefined();
  });

  it('records the skew from the last response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{}', {
            status: 200,
            headers: { date: new Date(Date.now() - 7 * 60_000).toUTCString() },
          }),
      ),
    );
    await ovokFetch('/fhir/R4/X');
    expect(Math.round(getClockSkewMs() / 60_000)).toBe(-7);
  });
});
