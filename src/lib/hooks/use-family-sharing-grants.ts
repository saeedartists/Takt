'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FhirRepository } from '@/lib/takt/fhir-repository';
import {
  buildFamilyShareConsent,
  buildFamilyShareRevokeConsent,
  toFamilySharingGrant,
  type ViewerRole,
} from '@/lib/takt/family-sharing';
import type { FamilySharingGrant, RelatedPersonResource } from '@/lib/takt/types';

const refId = (value?: string): string | undefined => value?.split('/')[1];

export const useFamilySharingGrants = (patientRef?: string) => {
  const consentQuery = useQuery({
    enabled: Boolean(patientRef),
    queryKey: ['takt', 'family-sharing', 'consent', patientRef],
    queryFn: async () =>
      FhirRepository.searchConsents(`patient=${encodeURIComponent(patientRef ?? '')}&_count=200&_sort=-date`),
  });

  const relatedQuery = useQuery({
    enabled: Boolean(patientRef),
    queryKey: ['takt', 'family-sharing', 'related-person', patientRef],
    queryFn: async () =>
      FhirRepository.searchRelatedPeople(`patient=${encodeURIComponent(patientRef ?? '')}&_count=200&_sort=-_lastUpdated`),
  });

  const grants = useMemo<FamilySharingGrant[]>(() => {
    const map = new Map<string, RelatedPersonResource>();
    for (const item of relatedQuery.data?.entry ?? []) {
      if (item.resource.id) {
        map.set(item.resource.id, item.resource);
      }
    }

    return (consentQuery.data?.entry ?? [])
      .map((item) => toFamilySharingGrant(item.resource, map))
      .filter((item): item is FamilySharingGrant => Boolean(item));
  }, [consentQuery.data?.entry, relatedQuery.data?.entry]);

  return {
    grants,
    isLoading: consentQuery.isLoading || relatedQuery.isLoading,
    error: consentQuery.error ?? relatedQuery.error,
    refetch: async () => {
      await Promise.all([consentQuery.refetch(), relatedQuery.refetch()]);
    },
  };
};

export const useGrantFamilySharing = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      patientRef: string;
      relatedPersonRef: string;
      relationshipCode?: string;
      grantedByRef: { reference: string };
    }) => {
      const consent = buildFamilyShareConsent(input);
      return FhirRepository.createConsent(consent);
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['takt', 'family-sharing', 'consent', variables.patientRef] });
    },
  });
};

export const useRevokeFamilySharing = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      grant: FamilySharingGrant;
      revokedByRef: { reference: string };
    }) => {
      const consentId = input.grant.consent.id;
      if (!consentId) {
        throw new Error('Cannot revoke a family share grant without consent id.');
      }

      const updated = buildFamilyShareRevokeConsent({ consent: input.grant.consent, revokedByRef: input.revokedByRef });
      return FhirRepository.updateConsent(consentId, updated);
    },
    onSuccess: (_data, variables) => {
      const patientRef = variables.grant.patientRef;
      void qc.invalidateQueries({ queryKey: ['takt', 'family-sharing', 'consent', patientRef] });
    },
  });
};

export const useViewerRole = (value: ViewerRole = 'patient'): ViewerRole => value;

export const familySharingRelativeIdFromGrant = (grant: FamilySharingGrant): string | undefined =>
  refId(grant.relatedPersonRef);
