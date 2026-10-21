import { FhirHttpError, type FhirClient, type SearchParams } from './fhir.js';
import { chunk } from './domain/push.js';
import { referenceId } from './domain/references.js';
import { readPlan } from './domain/schedule.js';
import type {
  CommunicationResource,
  ConsentResource,
  DeviceResource,
  FhirResource,
  MedicationAdministrationResource,
  MedicationPlan,
  MedicationRequestResource,
  MedicationResource,
  PatientResource,
  RelatedPersonResource,
} from './domain/types.js';

export const searchAll = async <T extends FhirResource>(
  fhir: FhirClient,
  resourceType: string,
  params: SearchParams = {},
  pageSize = 200,
  maxResults = 100_000,
): Promise<T[]> => {
  const results: T[] = [];
  const seenNextLinks = new Set<string>();
  let offset = 0;
  let bundle = await fhir.search<T>(resourceType, {
    ...params,
    _count: pageSize,
    _offset: offset,
  });

  for (let page = 0; page < 10_000; page += 1) {
    const entries = bundle.entry ?? [];
    results.push(...entries.map((entry) => entry.resource));

    const next = bundle.link?.find((link) => link.relation === 'next')?.url;
    const total = bundle.total;
    const hasMoreByTotal = typeof total === 'number' && results.length < total;
    const hasMoreByPage = entries.length >= pageSize;

    if (results.length >= maxResults) {
      if (next || hasMoreByTotal || hasMoreByPage) {
        throw new Error(
          `FHIR search ${resourceType} exceeded the ${maxResults.toString()} result safety limit.`,
        );
      }
      break;
    }

    if (!next && !hasMoreByTotal && !hasMoreByPage) break;
    if (entries.length === 0) break;

    if (next && fhir.searchNext) {
      if (seenNextLinks.has(next)) {
        throw new Error(`FHIR search ${resourceType} returned a repeating next link.`);
      }
      seenNextLinks.add(next);
      bundle = await fhir.searchNext<T>(next);
      continue;
    }

    offset += entries.length;
    bundle = await fhir.search<T>(resourceType, {
      ...params,
      _count: pageSize,
      _offset: offset,
    });
  }

  return results;
};

export const loadPatient = async (fhir: FhirClient, patientRef: string): Promise<PatientResource> => {
  const id = referenceId(patientRef);
  if (!id) throw new Error(`Invalid patient reference: ${patientRef}`);
  return fhir.read<PatientResource>(`/fhir/R4/Patient/${id}`);
};

export const loadPatientPlans = async (
  fhir: FhirClient,
  patientRef: string,
  zone: string,
): Promise<MedicationPlan[]> => {
  const requestResources = await searchAll<MedicationRequestResource>(fhir, 'MedicationRequest', {
    subject: patientRef,
    _sort: '-_lastUpdated',
  });
  const medicationIds = [
    ...new Set(
      requestResources
        .map((request) => referenceId(request.medicationReference?.reference))
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const medications: MedicationResource[] = [];
  for (const batch of chunk(medicationIds, 50)) {
    medications.push(
      ...(await searchAll<MedicationResource>(fhir, 'Medication', { _id: batch.join(',') })),
    );
  }
  const medicationById = new Map(
    medications.map((medication) => [medication.id, medication] as const),
  );

  return requestResources.map((request) =>
    readPlan(request, medicationById.get(referenceId(request.medicationReference?.reference)) ?? null, zone),
  );
};

export const loadAdministrationsSince = async (
  fhir: FhirClient,
  patientRef: string,
  sinceIso: string,
): Promise<MedicationAdministrationResource[]> => {
  try {
    return await searchAll<MedicationAdministrationResource>(
      fhir,
      'MedicationAdministration',
      {
        subject: patientRef,
        'effective-time': `ge${sinceIso}`,
        _sort: '-effective-time',
      },
      200,
    );
  } catch (error) {
    if (!(error instanceof FhirHttpError) || error.status !== 400) throw error;
    return await searchAll<MedicationAdministrationResource>(
      fhir,
      'MedicationAdministration',
      {
        subject: patientRef,
        _sort: '-effective-time',
      },
      200,
    );
  }
};

export const findRelatedPeopleByEmail = async (
  fhir: FhirClient,
  email: string,
): Promise<RelatedPersonResource[]> => {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];

  const attempts: Record<string, string | number>[] = [
    { telecom: `email|${normalized}` },
    { telecom: normalized },
  ];

  for (const params of attempts) {
    try {
      const resources = await searchAll<RelatedPersonResource>(fhir, 'RelatedPerson', params, 50);
      if (resources.length > 0) return resources;
    } catch (error) {
      if (!(error instanceof FhirHttpError) || (error.status !== 400 && error.status !== 404)) throw error;
    }
  }

  return [];
};

export const loadRelatedPeopleByIds = async (
  fhir: FhirClient,
  ids: string[],
): Promise<RelatedPersonResource[]> => {
  const unique = [...new Set(ids.filter(Boolean))];
  const resources: RelatedPersonResource[] = [];
  for (const batch of chunk(unique, 50)) {
    resources.push(
      ...(await searchAll<RelatedPersonResource>(fhir, 'RelatedPerson', {
        _id: batch.join(','),
      })),
    );
  }
  return resources;
};

export const loadFamilyShareConsents = async (
  fhir: FhirClient,
  patientRef: string,
): Promise<ConsentResource[]> =>
  searchAll<ConsentResource>(
    fhir,
    'Consent',
    { patient: patientRef, status: 'active', _sort: '-date' },
    200,
  );

export const loadRecentCommunications = async (
  fhir: FhirClient,
  patientRef: string,
  sinceIso: string,
): Promise<CommunicationResource[]> => {
  try {
    return await searchAll<CommunicationResource>(
      fhir,
      'Communication',
      { subject: patientRef, sent: `ge${sinceIso}`, _sort: '-sent' },
      200,
    );
  } catch (error) {
    if (!(error instanceof FhirHttpError) || error.status !== 400) throw error;
    return await searchAll<CommunicationResource>(
      fhir,
      'Communication',
      { subject: patientRef, _sort: '-sent' },
      200,
    );
  }
};

export const loadActiveDevices = async (fhir: FhirClient, patientRef: string): Promise<DeviceResource[]> =>
  searchAll<DeviceResource>(fhir, 'Device', {
    patient: patientRef,
    status: 'active',
  }, 50);
