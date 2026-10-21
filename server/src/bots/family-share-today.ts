import { DateTime } from 'luxon';
import type { FhirClient } from '../fhir.js';
import {
  buildFamilyShareTodayView,
  isActiveFamilyShare,
  relatedPersonLinkedAccount,
} from '../domain/family-sharing.js';
import { normalizeReference, sameReference } from '../domain/references.js';
import { patientTimezone, buildDoseOccurrencesForDay } from '../domain/schedule.js';
import { startOfDay } from '../domain/time.js';
import type { FamilyShareTodayView } from '../domain/types.js';
import {
  findRelatedPeopleByEmail,
  loadAdministrationsSince,
  loadFamilyShareConsents,
  loadPatient,
  loadPatientPlans,
} from '../fhir-queries.js';

export type FamilyShareTodayInput = {
  relativePatientRef: string;
  relativeEmail: string;
  patientRef?: string;
};

export type FamilyShareTodayDeps = {
  fhir: FhirClient;
  now?: Date | DateTime;
  defaultTimezone?: string;
};

export type FamilyShareTodayResult = {
  shares: FamilyShareTodayView[];
};

export class FamilyShareAccessError extends Error {
  constructor(public readonly reason: 'no-linked-invitation' | 'no-active-share') {
    super(reason);
    this.name = 'FamilyShareAccessError';
  }
}

export const runFamilyShareToday = async (
  input: FamilyShareTodayInput,
  deps: FamilyShareTodayDeps,
): Promise<FamilyShareTodayResult> => {
  const now = deps.now instanceof DateTime ? deps.now : DateTime.fromJSDate(deps.now ?? new Date());
  const relatedPeople = (await findRelatedPeopleByEmail(deps.fhir, input.relativeEmail)).filter(
    (relatedPerson) =>
      sameReference(relatedPersonLinkedAccount(relatedPerson), input.relativePatientRef) &&
      Boolean(relatedPerson.patient?.reference),
  );

  if (relatedPeople.length === 0) throw new FamilyShareAccessError('no-linked-invitation');

  const shares: FamilyShareTodayView[] = [];
  const seenPatients = new Set<string>();

  for (const relatedPerson of relatedPeople) {
    const patientRef = normalizeReference(relatedPerson.patient?.reference);
    if (!patientRef || seenPatients.has(patientRef)) continue;
    if (input.patientRef && !sameReference(input.patientRef, patientRef)) continue;

    const consents = await loadFamilyShareConsents(deps.fhir, patientRef);
    const consent = consents.find((candidate) =>
      isActiveFamilyShare(candidate, relatedPerson, input.relativePatientRef),
    );

    if (!consent) continue;

    const patient = await loadPatient(deps.fhir, patientRef);
    const zone = patientTimezone(patient, deps.defaultTimezone);
    const plans = await loadPatientPlans(deps.fhir, patientRef, zone);
    const since = now.minus({ days: 2 }).toUTC().toISO() ?? now.toUTC().toISO() ?? '';
    const administrations = await loadAdministrationsSince(deps.fhir, patientRef, since);
    const day = startOfDay(now, zone);
    const doses = buildDoseOccurrencesForDay(plans, administrations, day, now, zone);

    shares.push(buildFamilyShareTodayView(patient, patientRef, doses, now, zone));
    seenPatients.add(patientRef);
  }

  if (shares.length === 0) throw new FamilyShareAccessError('no-active-share');
  return { shares };
};
