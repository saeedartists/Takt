import type { FhirClient } from '../src/fhir.js';
import type { FhirBundle, FhirResource } from '../src/domain/types.js';

export type FakeFhir = FhirClient & {
  resources: Map<string, FhirResource[]>;
  created: FhirResource[];
  updated: FhirResource[];
  deleted: string[];
  reads: string[];
};

const bundle = <T extends FhirResource>(resources: T[]): FhirBundle<T> => ({
  resourceType: 'Bundle',
  total: resources.length,
  entry: resources.map((resource) => ({ resource })),
});

export const createFakeFhir = (initial: Record<string, FhirResource[]> = {}): FakeFhir => {
  const resources = new Map<string, FhirResource[]>(
    Object.entries(initial).map(([type, items]) => [type, [...items]]),
  );
  const created: FhirResource[] = [];
  const updated: FhirResource[] = [];
  const deleted: string[] = [];
  const reads: string[] = [];

  return {
    resources,
    created,
    updated,
    deleted,
    reads,
    async read<T extends FhirResource>(path: string): Promise<T> {
      reads.push(path);
      const [resourceType, id] = path.replace(/^\/fhir\/R4\//, '').split('/');
      const found = (resources.get(resourceType ?? '') ?? []).find((resource) => resource.id === id);
      if (!found) {
        const error = new Error(`Not found: ${path}`) as Error & { status: number };
        error.status = 404;
        throw error;
      }
      return found as T;
    },
    async search<T extends FhirResource>(
      resourceType: string,
      params: Record<string, string | number | boolean | undefined> = {},
    ): Promise<FhirBundle<T>> {
      const items = (resources.get(resourceType) ?? []) as T[];
      const filtered = items.filter((resource) => {
        const record = resource as Record<string, unknown>;
        if (params.subject && (record.subject as { reference?: string } | undefined)?.reference !== params.subject) {
          return false;
        }
        if (params.patient && (record.patient as { reference?: string } | undefined)?.reference !== params.patient) {
          return false;
        }
        if (params.recipient) {
          const recipients = (record.recipient as { reference?: string }[] | undefined) ?? [];
          if (!recipients.some((recipient) => recipient.reference === params.recipient)) return false;
        }
        if (params.identifier) {
          const raw = String(params.identifier);
          const separator = raw.indexOf('|');
          const system = separator >= 0 ? raw.slice(0, separator) : undefined;
          const value = separator >= 0 ? raw.slice(separator + 1) : raw;
          const identifiers = (record.identifier as { system?: string; value?: string }[] | undefined) ?? [];
          if (
            !identifiers.some(
              (identifier) =>
                identifier.value === value && (system === undefined || identifier.system === system),
            )
          ) {
            return false;
          }
        }
        if (params.telecom || params.email) {
          const raw = String(params.telecom ?? params.email);
          const separator = raw.indexOf('|');
          const telecomSystem = separator >= 0 ? raw.slice(0, separator) : 'email';
          const telecomValue = separator >= 0 ? raw.slice(separator + 1) : raw;
          const telecoms = (record.telecom as { system?: string; value?: string }[] | undefined) ?? [];
          if (
            !telecoms.some(
              (telecom) => telecom.system === telecomSystem && telecom.value === telecomValue,
            )
          ) {
            return false;
          }
        }
        if (params._id) {
          const ids = String(params._id).split(',');
          if (!ids.includes(String(record.id))) return false;
        }
        return true;
      });
      return bundle(filtered);
    },
    async create<T extends FhirResource>(
      resource: T,
      options?: { ifNoneExist?: string },
    ): Promise<T> {
      const conditional = options?.ifNoneExist;
      if (conditional?.startsWith('identifier=')) {
        const raw = decodeURIComponent(conditional.slice('identifier='.length));
        const separator = raw.indexOf('|');
        const system = separator >= 0 ? raw.slice(0, separator) : undefined;
        const value = separator >= 0 ? raw.slice(separator + 1) : raw;
        const existing = (resources.get(resource.resourceType) ?? []).find((candidate) => {
          const identifiers = (candidate as { identifier?: { system?: string; value?: string }[] })
            .identifier;
          return identifiers?.some(
            (identifier) =>
              identifier.value === value && (system === undefined || identifier.system === system),
          );
        });
        if (existing) return existing as T;
      }

      const next = { ...resource, id: resource.id ?? `created-${created.length + 1}` };
      created.push(next);
      resources.set(next.resourceType, [...(resources.get(next.resourceType) ?? []), next]);
      return next;
    },
    async update<T extends FhirResource>(resource: T): Promise<T> {
      updated.push(resource);
      return resource;
    },
    async delete(path: string): Promise<void> {
      deleted.push(path);
      const [resourceType, id] = path.replace(/^\/fhir\/R4\//, '').split('/');
      resources.set(
        resourceType ?? '',
        (resources.get(resourceType ?? '') ?? []).filter((resource) => resource.id !== id),
      );
    },
  };
};
