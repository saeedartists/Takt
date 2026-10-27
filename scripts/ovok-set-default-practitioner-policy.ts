#!/usr/bin/env -S node --import tsx/esm
/**
 * Takt: inspect + set DEFAULT_PRACTITIONER_ACCESS_POLICY for a real Ovok project.
 *
 * This script is meant to be run by the project admin against the project that
 * needs the setting. It is intentionally local/offline-safe in the sense that it
 * never prints secrets; it only reads what you give it via env and writes one
 * project setting value.
 *
 * What it does:
 *  1. Authenticate with client credentials (or a static token).
 *  2. Search AccessPolicy in the project so you can see existing ids/names.
 *  3. If you pass the name of an existing policy, set
 *     DEFAULT_PRACTITIONER_ACCESS_POLICY to AccessPolicy/<that id>.
 *
 * Usage:
 *   cd server && node ../scripts/ovok-set-default-practitioner-policy.ts
 *
 * Required env (pick one auth path):
 *   OVOK_API_URL
 *   OVOK_TENANT_CODE
 *   OVOK_CLIENT_ID + OVOK_CLIENT_SECRET + OVOK_TOKEN_URL
 *     OR
 *   OVOK_ACCESS_TOKEN
 *
 * Optional env:
 *   OVOK_DEFAULT_POLICY_NAME  -> if set, the script will attempt to set the
 *     DEFAULT_PRACTITIONER_ACCESS_POLICY to the AccessPolicy whose name matches
 *     this value.
 *
 * Safety notes:
 *  - This does not guess the policy id. It prints the existing AccessPolicy
 *    rows first so you can decide which one to use.
 *  - If OVOK_DEFAULT_POLICY_NAME is set but no matching AccessPolicy is found,
 *    the script exits without changing anything.
 */

// This script uses the same project convention as `server/scripts/*`, which loads
// config from `server/.env`. Run it from `server/` so `dotenv` resolves from
// server/node_modules.

import { createRequire } from 'module';

const serverRequire = createRequire(new URL('./server/', import.meta.url).href);

// Load env files using the same priority the server config uses.
function loadEnvFile(p: string) {
  try {
    serverRequire('dotenv').config({ path: p, override: false });
  } catch {
    // missing file or missing dotenv — leave env as-is
  }
}

loadEnvFile('./server/.env');
loadEnvFile('./server/.env.local');
loadEnvFile('./.env');
loadEnvFile('./.env.local');

// Final dotenv pass so explicitly-passed env vars stay ahead of file-based env.
try {
  serverRequire('dotenv').config();
} catch {}

// For the rest of this script we use the repo-root require so other node_modules
// (if any are installed at the repo root in future) resolve normally.
const rootRequire = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Tiny auth + FHIR helpers copied from the project's own server wiring style,
// but self-contained here so this script can run without importing compiled
// server code.
// ---------------------------------------------------------------------------

type TokenProvider = () => string | Promise<string>;

interface ClientCredentialsOptions {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  tenantCode?: string;
  scope?: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  token_type?: string;
}

function clientCredentialsTokenProvider(options: ClientCredentialsOptions): TokenProvider {
  let cached: { token: string; expiresAt: number } | undefined;
  let inFlight: Promise<string> | undefined;

  const fetchToken = async (): Promise<string> => {
    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('client_id', options.clientId);
    body.set('client_secret', options.clientSecret);
    if (options.tenantCode) body.set('tenant_code', options.tenantCode);
    if (options.scope) body.set('scope', options.scope);

    const response = await fetch(options.tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Ovok token request failed: ${response.status} ${text.slice(0, 300)}`);
    }

    const payload = (await response.json()) as TokenResponse;
    if (!payload.access_token) throw new Error('Ovok token response is missing access_token.');

    const expiresIn = Number(payload.expires_in ?? 3600);
    const lifetimeMs = (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000;
    cached = { token: payload.access_token, expiresAt: Date.now() + lifetimeMs };
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
}

interface FhirClient {
  search<T>(resourceType: string, params?: Record<string, string | number | boolean | undefined>): Promise<T>;
  read<T>(path: string): Promise<T>;
  update<T>(resource: T): Promise<T>;
}

class HttpFhirClient implements FhirClient {
  private readonly baseUrl: string;
  private readonly tenantCode: string;
  private readonly token: TokenProvider;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, tenantCode: string, token: TokenProvider, timeoutMs = 15_000) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.tenantCode = tenantCode;
    this.token = token;
    this.timeoutMs = timeoutMs;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/fhir+json');
    headers.set('x-tenant-code', this.tenantCode);
    headers.set('Authorization', `Bearer ${await this.token()}`);
    if (init?.body) headers.set('Content-Type', 'application/fhir+json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`FHIR request failed: ${response.status} ${path} — ${text.slice(0, 400)}`);
      }
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async search<T>(resourceType: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      query.set(key, String(value));
    }
    const suffix = query.toString();
    return this.request<T>(`/fhir/R4/${resourceType}${suffix ? `?${suffix}` : ''}`);
  }

  async read<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async update<T>(resource: T): Promise<T> {
    if (!('id' in resource) || !resource.id) throw new Error('Update requires an id.');
    return this.request<T>(`/fhir/R4/${resource.resourceType}/${resource.id}`, {
      method: 'PUT',
      body: JSON.stringify(resource),
    });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface ProjectSettingRecord {
  resourceType: string;
  id: string;
  values?: Record<string, { value: string | null }>;
}

interface AccessPolicy {
  resourceType: string;
  id: string;
  name?: string;
}

const requiredEnv = [
  'OVOK_API_URL',
  'OVOK_TENANT_CODE',
] as const;

function missingEnv() {
  for (const key of requiredEnv) {
    if (!process.env[key]) return key;
  }
  return null;
}

const authByClientCredentials =
  !!(process.env.OVOK_CLIENT_ID && process.env.OVOK_CLIENT_SECRET && process.env.OVOK_TOKEN_URL);

const authByToken = !!(process.env.OVOK_ACCESS_TOKEN);

function envOrDie(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
}

const main = async () => {
  const missing = missingEnv();
  if (missing) {
    console.error(`Missing env: ${missing}`);
    console.error('Required: OVOK_API_URL, OVOK_TENANT_CODE, and one auth path (client credentials OR OVOK_ACCESS_TOKEN).');
    process.exitCode = 1;
    return;
  }

  if (!authByClientCredentials && !authByToken) {
    console.error('No auth path configured. Set either OVOK_ACCESS_TOKEN, or OVOK_CLIENT_ID + OVOK_CLIENT_SECRET + OVOK_TOKEN_URL.');
    process.exitCode = 1;
    return;
  }

  const apiUrl = envOrDie('OVOK_API_URL').replace(/\/+$/, '');
  const tenantCode = envOrDie('OVOK_TENANT_CODE');

  const token: TokenProvider =
    authByToken
      ? () => process.env.OVOK_ACCESS_TOKEN!
      : clientCredentialsTokenProvider({
          tokenUrl: envOrDie('OVOK_TOKEN_URL'),
          clientId: envOrDie('OVOK_CLIENT_ID'),
          clientSecret: envOrDie('OVOK_CLIENT_SECRET'),
          tenantCode,
          scope: process.env.OVOK_SCOPE ?? undefined,
        });

  const fhir = new HttpFhirClient(apiUrl, tenantCode, token);

  console.log(`\nTarget: ${apiUrl} (tenant ${tenantCode})\n`);

  // 1. List existing AccessPolicies.
  console.log('Listing AccessPolicy resources in the project...');
  const policies = (await fhir.search<{ resourceType: string; entry?: Array<{ resource: AccessPolicy }>; total?: number }>(
    'AccessPolicy',
    { _count: 100 },
 ));

  const list = policies.entry?.map((e) => e.resource) ?? [];
  console.log(`Found ${list.length} AccessPolicy resource(s):`);
  for (const policy of list) {
    console.log(`  - ${policy.id}  name=${policy.name ?? '(no name)'}`);
  }

  if (list.length === 0) {
    console.log('\nNo AccessPolicy resources found in this project.');
    console.log('The setting DEFAULT_PRACTITIONER_ACCESS_POLICY cannot be set to an AccessPolicy that does not exist.');
    console.log('Next step: create one in FHIR Explorer (or via API), then come back and run this script again.');
    return;
  }

  // 2. Optionally set the setting.
  const desiredName = process.env.OVOK_DEFAULT_POLICY_NAME?.trim() ?? '';
  if (!desiredName) {
    console.log('\nNo OVOK_DEFAULT_POLICY_NAME set.');
    console.log('To set the default practitioner policy, re-run with:');
    console.log('  OVOK_DEFAULT_POLICY_NAME=<exact policy name> npx tsx scripts/ovok-set-default-practitioner-policy.ts');
    console.log('\nUse one of the policy ids/names printed above.');
    return;
  }

  const match = list.find((p) => (p.name ?? '').trim() === desiredName);
  if (!match) {
    console.error(`\nNo AccessPolicy with name "${desiredName}" found.`);
    console.error('Available names:');
    for (const policy of list) {
      console.error(`  - ${policy.name ?? '(no name)'}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\nMatched AccessPolicy: ${match.id}  name=${match.name}`);

  const settingValue = `AccessPolicy/${match.id}`;
  const settingPath = '/v1/project/settings/values/DEFAULT_PRACTITIONER_ACCESS_POLICY';

  console.log(`\nSetting ${settingPath} = ${settingValue}`);

  const put = await fetch(`${apiUrl}${settingPath}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await token()}`,
      'x-tenant-code': tenantCode,
    },
    body: JSON.stringify({ value: settingValue }),
  });

  const bodyText = await put.text().catch(() => '');
  let body: unknown = bodyText;
  try {
    body = JSON.parse(bodyText);
  } catch {
    // keep text
  }

  if (!put.ok) {
    console.error(`Failed to set setting: ${put.status}`);
    console.error(JSON.stringify(body, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log('Setting updated. Response:');
  console.log(JSON.stringify(body, null, 2));

  // 3. Re-read it back to confirm.
  const get = await fhir.read<ProjectSettingRecord>(settingPath);
  console.log('\nRe-read setting:');
  console.log(`  ${settingPath}`);
  if (get.values?.DEFAULT_PRACTITIONER_ACCESS_POLICY) {
    console.log(`  value = ${get.values.DEFAULT_PRACTITIONER_ACCESS_POLICY.value ?? 'null'}`);
  } else {
    console.log('  value = (not present)');
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
