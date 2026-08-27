'use client';

import { useMemo } from 'react';
import { useDoseEvents } from './use-dose-events';
import { useMedicationPlans } from './use-medication-plans';
import { buildDoseOccurrencesForDay } from '@/lib/takt/schedule';
import { startOfDay } from '@/lib/takt/time';

export const useTodayScheduleEvents = (patientRef?: string) => {
  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);

  const todayDoses = useMemo(
    () => buildDoseOccurrencesForDay(plans.plans, (events.data?.entry ?? []).map((entry) => entry.resource), startOfDay(new Date())),
    [events.data?.entry, plans.plans],
  );

  return {
    doses: todayDoses,
    isLoading: plans.isLoading || events.isLoading,
    error: plans.error ?? events.error,
    refetch: async () => {
      await Promise.all([plans.requestsQuery.refetch(), plans.medicationsQuery.refetch(), events.refetch()]);
    },
  };
};
