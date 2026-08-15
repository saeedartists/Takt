/*
 * mock-server — in-memory Ovok API responses for previewing the app
 * without a live tenant. Wired via EXPO_PUBLIC_OVOK_MOCK=1.
 *
 * Mobile counterpart of the web scaffold's src/lib/mock-server.ts.
 * Same FHIR store, same fixtures, same absent-`entry` fidelity rule —
 * so a screen written against one behaves the same on the other.
 *
 * Why this exists: an app pointed at the live API with no tenant
 * credentials renders empty lists on every screen. The code can be
 * perfectly correct and the app still looks broken. This makes the
 * first render show something real.
 *
 * Do NOT ship to production. `.env.local` carries the flag and is
 * excluded from the deploy payload (see NEVER_DEPLOY_BASENAMES in
 * apps/api/src/sandbox/sandbox-fs.service.ts).
 */

import { SEED, type FhirResource } from './seed/fixtures';

type MockRoute = {
  method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'PATCH';
  path: RegExp;
  respond: (
    req: { url: string; body: unknown; headers: Headers },
    match: RegExpMatchArray,
  ) => { status: number; body: unknown; headers?: Record<string, string> };
};

/* ------------------------------------------------------------------ */
/* In-memory FHIR store                                                */
/* ------------------------------------------------------------------ */

/* #region ovok:fhir-store — MUST be byte-identical across scaffolds.
 * Guarded by packages/shared/scripts/check-scaffold-parity.mjs. Edit both
 * copies together, or the guard fails CI. */
const store = new Map<string, Map<string, FhirResource>>();

const cloneResource = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

const bucket = (resourceType: string): Map<string, FhirResource> => {
  let b = store.get(resourceType);
  if (!b) {
    b = new Map();
    store.set(resourceType, b);
  }
  return b;
};

const seedStore = (): void => {
  store.clear();
  for (const [resourceType, resources] of Object.entries(SEED)) {
    const b = bucket(resourceType);
    for (const r of resources) b.set(r.id, cloneResource(r));
  }
};

const operationOutcome = (
  severity: 'error' | 'warning',
  code: string,
  diagnostics: string,
): FhirResource => ({
  resourceType: 'OperationOutcome',
  id: 'mock-outcome',
  issue: [{ severity, code, diagnostics }],
});

/** Read a dotted/nested value for the tiny `_sort` implementation. */
const sortKey = (r: FhirResource, field: string): string => {
  if (field === 'date' || field === '_lastUpdated') {
    return String(
      (r.effectiveDateTime as string | undefined) ??
        r.meta?.lastUpdated ??
        '',
    );
  }
  if (field === 'name') {
    const names = r.name as
      | Array<{ family?: string; given?: string[] }>
      | undefined;
    const n = names?.[0];
    return `${n?.family ?? ''} ${n?.given?.join(' ') ?? ''}`.trim();
  }
  const v = r[field];
  return typeof v === 'string' ? v : '';
};

/*
 * The handful of search params that actually matter for a generated
 * app's first screens. Anything unrecognised is ignored rather than
 * erroring — the real server would filter, but silently returning a
 * superset is far less confusing during a demo than an empty list.
 */
const matchesSearch = (
  r: FhirResource,
  params: URLSearchParams,
): boolean => {
  for (const [rawKey, value] of params.entries()) {
    if (rawKey.startsWith('_')) continue; // _count / _sort / _include …
    const key = rawKey.split(':')[0]!; // strip modifiers like name:contains

    if (key === 'subject' || key === 'patient') {
      const subject = r.subject as { reference?: string } | undefined;
      const ref = subject?.reference ?? '';
      // Accept both "Patient/pat-001" and a bare "pat-001".
      if (ref !== value && ref !== `Patient/${value}`) return false;
      continue;
    }
    if (key === 'code') {
      const coding = (r.code as { coding?: Array<{ code?: string }> } | undefined)?.coding ?? [];
      if (!coding.some((c) => c.code === value)) return false;
      continue;
    }
    if (key === 'status') {
      if (r.status !== value) return false;
      continue;
    }
    if (key === 'active') {
      if (String(r.active ?? '') !== value) return false;
      continue;
    }
    if (key === 'name' || key === 'family') {
      const names = r.name as
        | Array<{ family?: string; given?: string[] }>
        | undefined;
      const haystack = (names ?? [])
        .map((n) => `${n.family ?? ''} ${n.given?.join(' ') ?? ''}`)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(value.toLowerCase())) return false;
      continue;
    }
    if (key === 'identifier') {
      const ids = r.identifier as Array<{ value?: string }> | undefined;
      if (!(ids ?? []).some((i) => i.value === value)) return false;
      continue;
    }
    // Unknown param — ignore.
  }
  return true;
};

const searchBundle = (
  resourceType: string,
  params: URLSearchParams,
): Record<string, unknown> => {
  const all = [...bucket(resourceType).values()];
  let hits = all.filter((r) => matchesSearch(r, params));

  const sort = params.get('_sort');
  if (sort) {
    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    hits = [...hits].sort((a, b) => {
      const cmp = sortKey(a, field).localeCompare(sortKey(b, field));
      return desc ? -cmp : cmp;
    });
  }

  const total = hits.length;
  const count = Number.parseInt(params.get('_count') ?? '', 10);
  if (Number.isFinite(count) && count >= 0) hits = hits.slice(0, count);

  const bundle: Record<string, unknown> = {
    resourceType: 'Bundle',
    type: 'searchset',
    total,
  };
  // CRITICAL: omit `entry` entirely on zero results — that is what the
  // real FHIR server does, and apps that assume an array crash there.
  if (hits.length > 0) {
    bundle.entry = hits.map((r) => ({
      fullUrl: `${r.resourceType}/${r.id}`,
      resource: cloneResource(r),
      search: { mode: 'match' },
    }));
  }
  return bundle;
};

let nextIdCounter = 1000;
const nextId = (resourceType: string): string =>
  `${resourceType.toLowerCase().slice(0, 4)}-mock-${nextIdCounter++}`;
/* #endregion ovok:fhir-store */

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

const projectSettings: Record<string, { value: boolean; versionId: string }> = {
  CONTENT_ENABLED: { value: true, versionId: '1' },
  MAILING_ENABLED: { value: false, versionId: '1' },
  PATIENT_INVITATION_ENABLED: { value: true, versionId: '1' },
  PATIENT_REGISTRATION_ENABLED: { value: true, versionId: '1' },
  PATIENT_LOGIN_ENABLED: { value: true, versionId: '1' },
  PRACTITIONER_INVITATION_ENABLED: { value: true, versionId: '1' },
  PRACTITIONER_REGISTRATION_ENABLED: { value: false, versionId: '1' },
  PRACTITIONER_LOGIN_ENABLED: { value: true, versionId: '1' },
  IOT_ENABLED: { value: false, versionId: '1' },
};

const currentUser = {
  id: 'user-mock-1',
  email: 'demo@ovok.local',
  name: 'Demo User',
  isAdmin: true,
};

const routes: MockRoute[] = [
  {
    method: 'GET',
    path: /^\/v1\/auth\/me$/,
    respond: () => ({ status: 200, body: currentUser }),
  },
  {
    method: 'GET',
    path: /^\/v1\/project\/settings$/,
    respond: () => ({
      status: 200,
      body: Object.fromEntries(
        Object.entries(projectSettings).map(([k, v]) => [k, v.value]),
      ),
    }),
  },
  {
    method: 'PUT',
    path: /^\/v1\/project\/settings\/([^/]+)$/,
    respond: (req, match) => {
      const key = match[1]!;
      const entry = projectSettings[key];
      if (!entry) return { status: 404, body: { error: 'unknown key' } };
      const ifMatch = req.headers.get('if-match');
      if (ifMatch && !ifMatch.includes(entry.versionId)) {
        return { status: 409, body: { error: 'version mismatch' } };
      }
      const nextValue = (req.body as { value?: boolean })?.value ?? false;
      entry.value = nextValue;
      entry.versionId = (Number.parseInt(entry.versionId, 10) + 1).toString();
      return {
        status: 200,
        body: { key, value: nextValue },
        headers: { etag: `W/"${entry.versionId}"` },
      };
    },
  },

  /* ---------------- FHIR: search + create ---------------- */
  {
    method: 'GET',
    path: /^\/fhir(?:\/R[45])?\/([A-Z][A-Za-z]+)$/,
    respond: (req, match) => {
      const resourceType = match[1]!;
      const params = new URL(req.url, 'http://mock.local').searchParams;
      return { status: 200, body: searchBundle(resourceType, params) };
    },
  },
  {
    method: 'POST',
    path: /^\/fhir(?:\/R[45])?\/([A-Z][A-Za-z]+)$/,
    respond: (req, match) => {
      const resourceType = match[1]!;
      const input = (req.body ?? {}) as Partial<FhirResource>;
      const id = input.id ?? nextId(resourceType);
      const created: FhirResource = {
        ...(input as FhirResource),
        resourceType,
        id,
        meta: { versionId: '1', lastUpdated: new Date().toISOString() },
      };
      bucket(resourceType).set(id, created);
      return {
        status: 201,
        body: cloneResource(created),
        headers: { location: `${resourceType}/${id}`, etag: 'W/"1"' },
      };
    },
  },

  /* ---------------- FHIR: read / update / delete ---------------- */
  {
    method: 'GET',
    path: /^\/fhir(?:\/R[45])?\/([A-Z][A-Za-z]+)\/([^/?]+)$/,
    respond: (_req, match) => {
      const [, resourceType, id] = match as unknown as [string, string, string];
      const found = bucket(resourceType).get(id);
      if (!found) {
        return {
          status: 404,
          body: operationOutcome(
            'error',
            'not-found',
            `${resourceType}/${id} not found`,
          ),
        };
      }
      return {
        status: 200,
        body: cloneResource(found),
        headers: { etag: `W/"${found.meta?.versionId ?? '1'}"` },
      };
    },
  },
  {
    method: 'PUT',
    path: /^\/fhir(?:\/R[45])?\/([A-Z][A-Za-z]+)\/([^/?]+)$/,
    respond: (req, match) => {
      const [, resourceType, id] = match as unknown as [string, string, string];
      const b = bucket(resourceType);
      const prior = b.get(id);
      const nextVersion = String(
        Number.parseInt(prior?.meta?.versionId ?? '0', 10) + 1,
      );
      const updated: FhirResource = {
        ...((req.body ?? {}) as FhirResource),
        resourceType,
        id,
        meta: { versionId: nextVersion, lastUpdated: new Date().toISOString() },
      };
      b.set(id, updated);
      return {
        status: prior ? 200 : 201,
        body: cloneResource(updated),
        headers: { etag: `W/"${nextVersion}"` },
      };
    },
  },
  {
    method: 'DELETE',
    path: /^\/fhir(?:\/R[45])?\/([A-Z][A-Za-z]+)\/([^/?]+)$/,
    respond: (_req, match) => {
      const [, resourceType, id] = match as unknown as [string, string, string];
      bucket(resourceType).delete(id);
      return { status: 204, body: null };
    },
  },
];

const isMockEnabled = (): boolean =>
  process.env.EXPO_PUBLIC_OVOK_MOCK === '1' ||
  process.env.EXPO_PUBLIC_OVOK_MOCK === 'true';

/** True when the in-memory demo data is serving this app's API calls. */
export const isOvokMockActive = (): boolean => isMockEnabled();

let installed = false;

/*
 * Install the demo-data fetch interceptor.
 *
 * Called at module scope from app/_layout.tsx — NOT from an effect.
 * React Query fires `queryFn` while a screen is mounting, before a
 * parent effect would run, so an effect-based install loses the race
 * on first paint and the user sees an empty list on exactly the
 * screen meant to prove the app works.
 *
 * No `window` guard is needed here (unlike the web scaffold): React
 * Native has no SSR pass, so this only ever runs in the app runtime.
 *
 * Idempotent — repeat calls are no-ops.
 */
export const installOvokMocks = (): void => {
  if (!isMockEnabled() || installed || typeof globalThis.fetch !== 'function') {
    return;
  }
  installed = true;
  seedStore();

  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    const pathname = new URL(url, 'http://mock.local').pathname;

    for (const route of routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.path);
      if (!match) continue;
      const body =
        init?.body && typeof init.body === 'string' ? safeJson(init.body) : null;
      const headers = new Headers(init?.headers);
      const {
        status,
        body: responseBody,
        headers: responseHeaders,
      } = route.respond({ url, body, headers }, match);
      return new Response(
        responseBody === null ? null : JSON.stringify(responseBody),
        {
          status,
          headers: {
            'content-type': 'application/json',
            ...(responseHeaders ?? {}),
          },
        },
      );
    }

    return realFetch(input, init);
  };
};

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};
