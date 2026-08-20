'use client';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { ovokFetch } from '@/lib/ovok-fetch';
import { PRIMARY_PATIENT_STORAGE_KEY } from '@/lib/takt/constants';
import type { FhirBundle, PatientResource } from '@/lib/takt/types';

const readPatientById = async (id: string): Promise<PatientResource | null> => {
  try {
    return await ovokFetch<PatientResource>(`/fhir/R4/Patient/${id}`);
  } catch {
    return null;
  }
};

export const usePrimaryPatient = () =>
  useQuery<PatientResource | null>({
    queryKey: ['takt', 'patient', 'primary'],
    queryFn: async () => {
      const storedId = await AsyncStorage.getItem(PRIMARY_PATIENT_STORAGE_KEY);
      if (storedId) {
        const stored = await readPatientById(storedId);
        if (stored?.id) return stored;
      }

      const bundle = await ovokFetch<FhirBundle<PatientResource>>('/fhir/R4/Patient?_count=1&_sort=-_lastUpdated');
      const selected = bundle.entry?.[0]?.resource ?? null;

      if (selected?.id) {
        await AsyncStorage.setItem(PRIMARY_PATIENT_STORAGE_KEY, selected.id);
      }

      return selected;
    },
  });
