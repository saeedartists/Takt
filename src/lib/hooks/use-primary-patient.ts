'use client';

import { useQuery } from '@tanstack/react-query';
import { ovokFetch } from '@/lib/ovok-fetch';
import type { FhirBundle, PatientResource } from '@/lib/takt/types';

export const usePrimaryPatient = () =>
  useQuery<PatientResource | null>({
    queryKey: ['takt', 'patient', 'primary'],
    queryFn: async () => {
      const bundle = await ovokFetch<FhirBundle<PatientResource>>(
        '/fhir/R4/Patient?_count=1&_sort=-_lastUpdated',
      );
      return bundle.entry?.[0]?.resource ?? null;
    },
  });
