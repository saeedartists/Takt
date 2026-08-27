'use client';

import { useMemo } from 'react';
import { useConsentEvents } from './use-consent-events';

export const useConsentStatus = (patientRef?: string) => {
  const query = useConsentEvents(patientRef);

  const current = useMemo(() => {
    const sorted = [...(query.data?.entry ?? [])]
      .map((entry) => entry.resource)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

    const latest = sorted[0];
    return {
      currentStatus: latest?.status ?? 'unknown',
      currentAt: latest?.dateTime,
      isActive: latest?.status === 'active',
      totalEvents: sorted.length,
    };
  }, [query.data?.entry]);

  return {
    ...current,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
