'use client';

import { useQuery } from '@tanstack/react-query';
import { FhirRepository } from '@/lib/takt/fhir-repository';
import type { ConsentResource, FhirBundle } from '@/lib/takt/types';

export const useConsentEvents = (patientRef?: string) =>
  useQuery<FhirBundle<ConsentResource>>({
    enabled: Boolean(patientRef),
    queryKey: ['takt', 'Consent', patientRef],
    queryFn: () =>
      FhirRepository.searchConsents(`patient=${encodeURIComponent(patientRef ?? '')}&_count=100&_sort=-date`),
  });
