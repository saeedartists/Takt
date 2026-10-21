import { describe, expect, it, vi } from 'vitest';
import { clientCredentialsTokenProvider, OvokAuthError } from '../src/ovok.js';

const tokenResponse = (): Response =>
  new Response(JSON.stringify({ access_token: 'access-1', expires_in: 3600 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('clientCredentialsTokenProvider', () => {
  it('deduplicates concurrent token requests and caches the token', async () => {
    const fetchMock = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return tokenResponse();
    }) as unknown as typeof fetch;
    const provider = clientCredentialsTokenProvider({
      tokenUrl: 'https://api.ovok.test/oauth/token',
      clientId: 'client',
      clientSecret: 'secret',
      fetchImpl: fetchMock,
    });

    const [first, second] = await Promise.all([provider(), provider()]);
    expect(first).toBe('access-1');
    expect(second).toBe('access-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(provider()).resolves.toBe('access-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces token endpoint failures without leaking the secret', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: 'invalid_client', error_description: 'Client authentication failed' }),
          { status: 401 },
        ),
    ) as unknown as typeof fetch;
    const provider = clientCredentialsTokenProvider({
      tokenUrl: 'https://api.ovok.test/oauth/token',
      clientId: 'client',
      clientSecret: 'super-secret',
      fetchImpl: fetchMock,
    });

    const error = await Promise.resolve(provider()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(OvokAuthError);
    expect((error as Error).message).toContain('401');
    expect((error as Error).message).not.toContain('super-secret');
  });
});
