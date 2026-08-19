'use client';

import { useQuery } from '@tanstack/react-query';
import { ovokFetch } from '@/lib/ovok-fetch';
import type { FhirBundle, MedicationAdministrationResource } from '@/lib/takt/types';

export const useDoseEvents = (patientRef?: string) =>
  useQuery<FhirBundle<MedicationAdministrationResource>>({
    enabled: Boolean(patientRef),
    queryKey: ['takt', 'MedicationAdministration', patientRef],
    queryFn: () =>
      ovokFetch<FhirBundle<MedicationAdministrationResource>>(
        `/fhir/R4/MedicationAdministration?subject=${encodeURIComponent(patientRef ?? '')}&_count=500&_sort=-effectiveDateTime`,
      ),
  });
