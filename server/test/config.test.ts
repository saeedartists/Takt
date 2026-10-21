import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('applies safe defaults for optional tuning values', () => {
    const config = loadConfig({ OVOK_TENANT_CODE: 'takt-test' });
    expect(config.OVOK_API_URL).toBe('https://api.ovok.com');
    expect(config.OVOK_REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(config.OVOK_MAX_RETRIES).toBe(2);
    expect(config.TAKT_QUIET_HOURS_START).toBe(21);
    expect(config.TAKT_QUIET_HOURS_END).toBe(8);
    expect(config.TAKT_UNCONFIRMED_HOURS).toBe(2);
    expect(config.TAKT_BOT_CONCURRENCY).toBe(4);
  });

  it('rejects missing tenant configuration and out-of-range values', () => {
    expect(() => loadConfig({})).toThrow();
    expect(() =>
      loadConfig({ OVOK_TENANT_CODE: 'takt-test', TAKT_BOT_CONCURRENCY: '0' }),
    ).toThrow();
    expect(() =>
      loadConfig({ OVOK_TENANT_CODE: 'takt-test', TAKT_QUIET_HOURS_START: '24' }),
    ).toThrow();
    expect(() =>
      loadConfig({ OVOK_TENANT_CODE: 'takt-test', TAKT_DEFAULT_TIMEZONE: 'Not/AZone' }),
    ).toThrow();
    expect(() =>
      loadConfig({
        OVOK_TENANT_CODE: 'takt-test',
        TAKT_UNCONFIRMED_HOURS: '10',
        TAKT_MAX_AGE_HOURS: '5',
      }),
    ).toThrow();
  });
});
