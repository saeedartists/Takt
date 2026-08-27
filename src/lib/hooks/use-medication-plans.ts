'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FhirRepository } from '@/lib/takt/fhir-repository';
import { TAKT_EXT } from '@/lib/takt/constants';
import { fromTimeOfDay, normalizeWeekdayCodes, sortTimes, WEEKDAY_ORDER, WEEKDAYS_ONLY } from '@/lib/takt/time';
import type {
  FhirBundle,
  MedicationCadence,
  MedicationPlan,
  MedicationRequestResource,
  MedicationResource,
  PausePeriod,
  WeekdayCode,
} from '@/lib/takt/types';

const readStrength = (medication: MedicationResource | null): string => {
  if (!medication) return '';
  const extension = medication.extension?.find((x) => x.url === TAKT_EXT.strength)?.valueString;
  if (extension) return extension;
  const codeText = medication.code?.text ?? '';
  const match = codeText.match(/\b(\d+\s?(mg|mcg|µg|g|ml))\b/i);
  return match?.[1] ?? '';
};

const readRequestExtensionString = (request: MedicationRequestResource, url: string): string | undefined =>
  request.extension?.find((x) => x.url === url)?.valueString;

const readRequestExtensionDateTime = (request: MedicationRequestResource, url: string): string | undefined =>
  request.extension?.find((x) => x.url === url)?.valueDateTime;

const readPauseHistory = (request: MedicationRequestResource): PausePeriod[] => {
  const raw = readRequestExtensionString(request, TAKT_EXT.pauseHistory);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is PausePeriod => {
        if (!item || typeof item !== 'object') return false;
        const candidate = item as { start?: unknown; end?: unknown };
        if (typeof candidate.start !== 'string') return false;
        if (candidate.end !== undefined && typeof candidate.end !== 'string') return false;
        return true;
      })
      .map((item) => ({ start: item.start, end: item.end }))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  } catch {
    return [];
  }
};

const readCreatedAt = (request: MedicationRequestResource): string | undefined => {
  const ext = readRequestExtensionDateTime(request, TAKT_EXT.requestCreatedAt);
  if (ext) return ext;
  if (request.authoredOn) return `${request.authoredOn}T00:00:00.000Z`;
  return undefined;
};

const readTimes = (request: MedicationRequestResource): string[] => {
  const times = request.dosageInstruction?.[0]?.timing?.repeat?.timeOfDay ?? [];
  if (times.length === 0) return ['08:00'];
  return sortTimes(times.map(fromTimeOfDay));
};

const readDayOfWeek = (request: MedicationRequestResource): WeekdayCode[] => {
  const days = request.dosageInstruction?.[0]?.timing?.repeat?.dayOfWeek ?? [];
  if (days.length === 0) return WEEKDAY_ORDER;
  const normalized = normalizeWeekdayCodes(days);
  return normalized.length > 0 ? normalized : WEEKDAY_ORDER;
};

const readCadence = (dayOfWeek: WeekdayCode[]): MedicationCadence => {
  if (dayOfWeek.length === WEEKDAY_ORDER.length) return 'daily';
  if (
    dayOfWeek.length === WEEKDAYS_ONLY.length &&
    WEEKDAYS_ONLY.every((day, idx) => dayOfWeek[idx] === day)
  ) {
    return 'weekdays';
  }
  return 'custom';
};

export const useMedicationPlans = (patientRef?: string) => {
  const requestsQuery = useQuery<FhirBundle<MedicationRequestResource>>({
    enabled: Boolean(patientRef),
    queryKey: ['takt', 'MedicationRequest', patientRef],
    queryFn: () =>
      FhirRepository.searchMedicationRequests(`subject=${encodeURIComponent(patientRef ?? '')}&_count=200&_sort=-_lastUpdated`),
  });

  const medicationsQuery = useQuery<FhirBundle<MedicationResource>>({
    queryKey: ['takt', 'Medication', 'all'],
    queryFn: () => FhirRepository.searchMedications('_count=200'),
  });

  const plans = useMemo<MedicationPlan[]>(() => {
    const medicationById = new Map(
      (medicationsQuery.data?.entry ?? []).map(({ resource }) => [resource.id, resource]),
    );

    return (requestsQuery.data?.entry ?? []).map(({ resource: request }) => {
      const ref = request.medicationReference?.reference?.split('/')[1];
      const medication = ref ? medicationById.get(ref) ?? null : null;
      const dayOfWeek = readDayOfWeek(request);

      return {
        request,
        medication,
        label: medication?.code?.text ?? request.medicationReference?.display ?? 'Medication',
        form: medication?.form?.text ?? '',
        strength: readStrength(medication),
        times: readTimes(request),
        cadence: readCadence(dayOfWeek),
        dayOfWeek,
        supplyCount: request.dispenseRequest?.quantity?.value,
        createdAt: readCreatedAt(request),
        archivedAt: readRequestExtensionDateTime(request, TAKT_EXT.archivedAt),
        pauseHistory: readPauseHistory(request),
      };
    });
  }, [medicationsQuery.data?.entry, requestsQuery.data?.entry]);

  return {
    requestsQuery,
    medicationsQuery,
    plans,
    isLoading: requestsQuery.isLoading || medicationsQuery.isLoading,
    error: requestsQuery.error ?? medicationsQuery.error,
  };
};
