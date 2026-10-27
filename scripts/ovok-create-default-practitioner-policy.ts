#!/usr/bin/env node
/**
 * Takt: create a default practitioner AccessPolicy in a real Ovok project and set
 * DEFAULT_PRACTITIONER_ACCESS_POLICY to it.
 *
 * This is the companion to scripts/ovok-set-default-practitioner-policy.ts.
 * It uses the same auth + FHIR helper style, but goes one step further: it
 * creates an AccessPolicy resource if one with the desired name does not yet
 * exist, then writes the project setting.
 *
 * Usage:
 *   cd server && node ../scripts/ovok-create-default-practitioner-policy.ts
 *
 * Required env (pick one auth path):
 *   OVOK_API_URL
 *   OVOK_TENANT_CODE
 *   OVOK_CLIENT_ID + OVOK_CLIENT_SECRET + OVOK_TOKEN_URL
 *     OR
 *   OVOK_ACCESS_TOKEN
 *
 * Optional env:
 *   OVOK_DEFAULT_POLICY_NAME          -> policy name to ensure (default below)
 *   OVOK_DEFAULT_POLICY_RESOURCE_TYPES-> comma-separated types to include
 *                                       (default: Patient,MedicationRequest,MedicationAdministration,Medication,Consent,RelatedPerson,Device)
 *   OVOK_DEFAULT_POLICY_READONLY      -> "true" for a read-only default policy
 *
 * Safety notes:
 *  - If a policy with OVOK_DEFAULT_POLICY_NAME already exists, this script does
 *    not touch it. It only creates a policy when there is no exact name match.
 *  - It never prints full client secrets. It may print masked values for
 *    debugging only.
 */

import { createRequire } from 'module';

const serverRequire = createRequire(new URL('./server/', import.meta.url).href);

try {
  serverRequire('dotenv').config({ path: './server/.env', override: false });
} catch {}

try {
  serverRequire('dotenv').config({ path: './.env', override: false });
} catch {}

try {
  serverRequire('dotenv').config({ path: './server/.env.local', override: false });
} catch {}

try {
  serverRequire('dotenv').config({ path: './.env.local', override: false });
} catch {}

try {
  serverRequire('dotenv').config();
} catch {}

// ---------------------------------------------------------------------------
// Tiny helpers (same shape as the project’s server wiring, but self-contained)
// ---------------------------------------------------------------------------

interface ClientCredentialsOptions {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  tenantCode?: string;
  scope?: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: string | number;
  token_type?: string;
}

function clientCredentialsTokenProvider(options: ClientCredentialsOptions) {
  let cached: { token: string; expiresAt: number } | undefined;
  let inFlight: Promise<string> | undefined;

  const fetchToken = async () => {
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
  create<T>(resource: T): Promise<T>;
  update<T>(resource: T): Promise<T>;
  delete(path: string): Promise<void>;
}

class HttpFhirClient implements FhirClient {
  private readonly baseUrl: string;
  private readonly tenantCode: string;
  private readonly token: () => string | Promise<string>;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, tenantCode: string, token: () => string | Promise<string>, timeoutMs = 15_000) {
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

  async search<T>(resourceType: string, params: Record<string, string | number | boolean | undefined> = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      query.set(key, String(value));
    }
    const suffix = query.toString();
    return this.request<T>(`/fhir/R4/${resourceType}${suffix ? `?${suffix}` : ''}`);
  }

  async read<T>(path: string) {
    return this.request<T>(path);
  }

  async create<T>(resource: T) {
    return this.request<T>(`/fhir/R4/${resource.resourceType}`, {
      method: 'POST',
      body: JSON.stringify(resource),
    });
  }

  async update<T>(resource: T) {
    if (!resource.id) throw new Error('Update requires an id.');
    return this.request<T>(`/fhir/R4/${resource.resourceType}/${resource.id}`, {
      method: 'PUT',
      body: JSON.stringify(resource),
    });
  }

  async delete(path: string) {
    await this.request<void>(path, { method: 'DELETE' });
  }
}

interface AccessPolicy {
  resourceType: 'AccessPolicy';
  id?: string;
  name: string;
  resource?: Array<{
    resourceType?: string;
    type?: string;
    criteria?: string;
    interaction?: string[];
    readonly?: boolean;
  }>;
}

interface AccessPolicyList {
  resourceType: string;
  entry?: Array<{ resource: AccessPolicy }>;
  total?: number;
}

interface ProjectSettingRecord {
  resourceType: string;
  id: string;
  values?: Record<string, { value: string | null }>;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function maskedSecret(secret: string) {
  return secret.length >= 8 ? secret.slice(0, 4) + '…'.repeat(4) : '<set>';
}

const DEFAULT_POLICY_NAME = 'Takt default practitioner policy v1';

const main = async () => {
  const apiUrl = process.env.OVOK_API_URL?.replace(/\/+$/, '');
  const tenantCode = process.env.OVOK_TENANT_CODE?.trim();
  const clientId = process.env.OVOK_CLIENT_ID?.trim();
  const clientSecret = process.env.OVOK_CLIENT_SECRET ?? '';
  const tokenUrl = process.env.OVOK_TOKEN_URL?.trim();
  const accessToken = process.env.OVOK_ACCESS_TOKEN?.trim();
  const scope = process.env.OVOK_SCOPE?.trim() ?? undefined;

  if (!apiUrl) {
    console.error('Missing OVOK_API_URL');
    process.exitCode = 1;
    return;
  }
  if (!tenantCode) {
    console.error('Missing OVOK_TENANT_CODE');
    process.exitCode = 1;
    return;
  }

  const useClientCredentials = !!(clientId && clientSecret && tokenUrl);
  const useStaticToken = !!accessToken;

  if (!useClientCredentials && !useStaticToken) {
    console.error('No auth path configured. Set OVOK_ACCESS_TOKEN or OVOK_CLIENT_ID + OVOK_CLIENT_SECRET + OVOK_TOKEN_URL.');
    process.exitCode = 1;
    return;
  }

  const token: () => string | Promise<string> = useStaticToken
    ? () => accessToken
    : clientCredentialsTokenProvider({
        tokenUrl,
        clientId,
        clientSecret,
        tenantCode,
        scope,
      });

  const fhir = new HttpFhirClient(apiUrl, tenantCode, token);

  console.log(`Target: ${apiUrl} (tenant ${tenantCode})`);
  if (useClientCredentials) {
    console.log(`Auth: client credentials client=${clientId} secret=${maskedSecret(clientSecret)} tokenUrl=${tokenUrl}`);
  } else {
    console.log('Auth: static token (first 8 chars shown)');
  }

  const policyName = (process.env.OVOK_DEFAULT_POLICY_NAME ?? '').trim() || DEFAULT_POLICY_NAME;
  const typesRaw = (process.env.OVOK_DEFAULT_POLICY_RESOURCE_TYPES ?? '').trim();
  const types = typesRaw
    ? typesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : ['Patient', 'MedicationRequest', 'MedicationAdministration', 'Medication', 'Consent', 'RelatedPerson', 'Device'];
  const readOnly = process.env.OVOK_DEFAULT_POLICY_READONLY === 'true';

  console.log(`Desired default practitioner policy name: ${policyName}`);
  console.log(`Desired resource types: ${types.join(',')}`);
  console.log(`Read-only: ${readOnly}`);

  // 1. Find existing policy with that exact name.
  let existing: AccessPolicy | undefined;
  try {
    const list = await fhir.search<AccessPolicyList>('AccessPolicy', { _count: 200 });
    const entries = list.entry?.map((e) => e.resource) ?? [];
    existing = entries.find((p) => (p.name ?? '').trim() === policyName);
    console.log(`Found ${entries.length} AccessPolicy resource(s) in the project.`);
    for (const p of entries) {
      console.log(`  - ${p.id ?? '<no id>'}  name=${p.name ?? '(no name)'}`);
    }
    if (existing) {
      console.log(`Existing policy matches desired name: ${existing.id}`);
    }
  } catch (error) {
    console.error('Failed to list AccessPolicy resources.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  // 2. Create if missing.
  let policyId = existing?.id;
  if (!policyId) {
    console.log('\nNo existing AccessPolicy with that name. Creating one...');

    const resource: AccessPolicy = {
      resourceType: 'AccessPolicy',
      name: policyName,
      resource: types.map((type) => ({
        // Use both "type" and "resourceType" so the body matches the server’s
        // likely expectations; the server is the source of truth here.
        resourceType: type,
        type,
        criteria: type === 'Patient' ? 'Patient?_id=%profile' : undefined,
        interaction: readOnly ? ['read', 'search'] : ['read', 'search', 'create', 'update'],
        readonly: readOnly ? true : undefined,
      })),
    };

    try {
      const created = await fhir.create<AccessPolicy>(resource);
      if (!created.id) {
        console.error('Server created the AccessPolicy but did not return an id.');
        process.exitCode = 1;
        return;
      }
      policyId = created.id;
      console.log(`Created AccessPolicy: ${policyId}  name=${created.name}`);
    } catch (error) {
      console.error('Failed to create AccessPolicy.');
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
      return;
    }
  }

  if (!policyId) {
    console.error('No policy id available after creation attempt.');
    process.exitCode = 1;
    return;
  }

  // 3. Set the project setting.
  const settingValue = `AccessPolicy/${policyId}`;
  const settingPath = '/v1/project/settings/values/DEFAULT_PRACTITIONER_ACCESS_POLICY';

  console.log(`\nSetting ${settingPath} = ${settingValue}`);

  try {
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
  } catch (error) {
    console.error('Failed to set setting (network).');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  // 4. Re-read to confirm.
  try {
    const get = await fhir.read<ProjectSettingRecord>(settingPath);
    console.log('\nRe-read setting:');
    console.log(`  ${settingPath}`);
    if (get.values?.DEFAULT_PRACTITIONER_ACCESS_POLICY) {
      console.log(`  value = ${get.values.DEFAULT_PRACTITIONER_ACCESS_POLICY.value ?? 'null'}`);
    } else {
      console.log('  value = (not present)');
    }
  } catch (error) {
    console.error('Failed to re-read setting.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  console.log('\nDone.');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
