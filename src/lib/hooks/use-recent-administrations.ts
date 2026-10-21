'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDoseEvents } from './use-dose-events';

const DAY_MS = 24 * 60 * 60 * 1000;

export const useRecentAdministrations = (patientRef?: string, days = 14) => {
  const events = useDoseEvents(patientRef);

  // "Now" lives in state so the render stays pure; it refreshes on mount
  // and every minute while mounted, keeping the window current without
  // impure Date.now() calls during render.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const rows = useMemo(() => {
    if (now === null) return [];
    const floor = now - days * DAY_MS;
    return (events.data?.entry ?? [])
      .map((entry) => entry.resource)
      .filter((resource) => {
        const ts = resource.effectiveDateTime ? new Date(resource.effectiveDateTime).getTime() : 0;
        return ts >= floor;
      });
  }, [days, events.data?.entry, now]);

  return {
    administrations: rows,
    /** False until the time window has been computed once. */
    isLoading: events.isLoading || now === null,
    error: events.error,
    refetch: events.refetch,
  };
};
