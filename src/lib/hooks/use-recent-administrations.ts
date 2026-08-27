'use client';

import { useMemo } from 'react';
import { useDoseEvents } from './use-dose-events';

const DAY_MS = 24 * 60 * 60 * 1000;

export const useRecentAdministrations = (patientRef?: string, days = 14) => {
  const events = useDoseEvents(patientRef);

  const rows = useMemo(() => {
    const floor = Date.now() - days * DAY_MS;
    return (events.data?.entry ?? [])
      .map((entry) => entry.resource)
      .filter((resource) => {
        const ts = resource.effectiveDateTime ? new Date(resource.effectiveDateTime).getTime() : 0;
        return ts >= floor;
      });
  }, [days, events.data?.entry]);

  return {
    administrations: rows,
    isLoading: events.isLoading,
    error: events.error,
    refetch: events.refetch,
  };
};
