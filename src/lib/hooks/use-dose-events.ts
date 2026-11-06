'use client';

import { useQuery } from '@tanstack/react-query';
import { FhirRepository } from '@/lib/takt/fhir-repository';
import type { FhirBundle, MedicationAdministrationResource } from '@/lib/takt/types';

// FHIR search param is `effective-time`; Ovok rejects `_sort=-effectiveDateTime` with 400.
export const useDoseEvents = (patientRef?: string) =>
  useQuery<FhirBundle<MedicationAdministrationResource>>({
    enabled: Boolean(patientRef),
    queryKey: ['takt', 'MedicationAdministration', patientRef],
    queryFn: () =>
      FhirRepository.searchMedicationAdministrations(
        `subject=${encodeURIComponent(patientRef ?? '')}&_count=500&_sort=-effective-time`,
      ),
  });
