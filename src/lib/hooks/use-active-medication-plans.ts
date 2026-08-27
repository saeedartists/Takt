'use client';

import { useMemo } from 'react';
import { useMedicationPlans } from './use-medication-plans';

export const useActiveMedicationPlans = (patientRef?: string) => {
  const plans = useMedicationPlans(patientRef);

  const activePlans = useMemo(
    () => plans.plans.filter((plan) => plan.request.status === 'active' || plan.request.status === 'on-hold'),
    [plans.plans],
  );

  return {
    plans: activePlans,
    isLoading: plans.isLoading,
    error: plans.error,
    refetch: async () => {
      await Promise.all([plans.requestsQuery.refetch(), plans.medicationsQuery.refetch()]);
    },
  };
};
