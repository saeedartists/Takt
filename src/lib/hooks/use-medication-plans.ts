'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ovokFetch } from '@/lib/ovok-fetch';
import { TAKT_EXT } from '@/lib/takt/constants';
import { fromTimeOfDay, normalizeWeekdayCodes, sortTimes, WEEKDAY_ORDER, WEEKDAYS_ONLY } from '@/lib/takt/time';
import type {
  FhirBundle,
  MedicationCadence,
  MedicationPlan,
  MedicationRequestResource,
  MedicationResource,
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
      ovokFetch<FhirBundle<MedicationRequestResource>>(
        `/fhir/R4/MedicationRequest?subject=${encodeURIComponent(patientRef ?? '')}&_count=200&_sort=-_lastUpdated`,
      ),
  });

  const medicationsQuery = useQuery<FhirBundle<MedicationResource>>({
    queryKey: ['takt', 'Medication', 'all'],
    queryFn: () => ovokFetch<FhirBundle<MedicationResource>>('/fhir/R4/Medication?_count=200'),
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
        label: medication?.code?.text ?? 'Medication',
        form: medication?.form?.text ?? '',
        strength: readStrength(medication),
        times: readTimes(request),
        cadence: readCadence(dayOfWeek),
        dayOfWeek,
        supplyCount: request.dispenseRequest?.quantity?.value,
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
