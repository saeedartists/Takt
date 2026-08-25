'use client';

import { useQuery } from '@tanstack/react-query';
import { ovokFetch } from '@/lib/ovok-fetch';
import type { ConsentResource, FhirBundle } from '@/lib/takt/types';

export const useConsentEvents = (patientRef?: string) =>
  useQuery<FhirBundle<ConsentResource>>({
    enabled: Boolean(patientRef),
    queryKey: ['takt', 'Consent', patientRef],
    queryFn: () =>
      ovokFetch<FhirBundle<ConsentResource>>(
        `/fhir/R4/Consent?patient=${encodeURIComponent(patientRef ?? '')}&_count=100&_sort=-date`,
      ),
  });
