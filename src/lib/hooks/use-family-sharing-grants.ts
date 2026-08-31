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
import {
  validateConsentResource,
  validateRelatedPersonResource,
} from '@/lib/takt/fhir-validation';
import type { FamilySharingGrant, RelatedPersonResource } from '@/lib/takt/types';

const refId = (value?: string): string | undefined => value?.split('/')[1];

const relationshipCoding = (relationshipCode: string) => ({
  system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
  code: relationshipCode,
  display:
    relationshipCode === 'SPS' ? 'spouse' : relationshipCode === 'CGV' ? 'caregiver' : 'relative',
});

export const useFamilySharingGrants = (patientRef?: string) => {
  const consentQuery = useQuery({
    enabled: Boolean(patientRef),
    queryKey: ['takt', 'family-sharing', 'consent', patientRef],
    queryFn: async () =>
      FhirRepository.searchConsents(
        `patient=${encodeURIComponent(patientRef ?? '')}&_count=200&_sort=-date`,
      ),
  });

  const relatedQuery = useQuery({
    enabled: Boolean(patientRef),
    queryKey: ['takt', 'family-sharing', 'related-person', patientRef],
    queryFn: async () =>
      FhirRepository.searchRelatedPeople(
        `patient=${encodeURIComponent(patientRef ?? '')}&_count=200&_sort=-_lastUpdated`,
      ),
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

  const relatedPeople = useMemo<RelatedPersonResource[]>(
    () => (relatedQuery.data?.entry ?? []).map((item) => item.resource),
    [relatedQuery.data?.entry],
  );

  return {
    grants,
    relatedPeople,
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
      givenName: string;
      familyName: string;
      relationshipCode: string;
      email?: string;
      grantedByRef: { reference: string };
    }) => {
      const relatedPerson: RelatedPersonResource = {
        resourceType: 'RelatedPerson',
        active: true,
        patient: { reference: input.patientRef },
        name: [
          {
            use: 'official',
            given: [input.givenName.trim()],
            family: input.familyName.trim(),
          },
        ],
        relationship: [{ coding: [relationshipCoding(input.relationshipCode)] }],
        telecom: input.email
          ? [{ system: 'email', use: 'home', value: input.email.trim().toLowerCase() }]
          : undefined,
      };

      const relatedValidation = validateRelatedPersonResource(relatedPerson);
      if (!relatedValidation.ok) {
        throw new Error(relatedValidation.issues[0]?.message ?? 'Family member data is invalid.');
      }

      const createdRelated = await FhirRepository.createRelatedPerson(relatedPerson);
      if (!createdRelated.id) {
        throw new Error('Family member was created without an id.');
      }

      const consent = buildFamilyShareConsent({
        patientRef: input.patientRef,
        relatedPersonRef: `RelatedPerson/${createdRelated.id}`,
        relationshipCode: input.relationshipCode,
        grantedByRef: input.grantedByRef,
      });

      const consentValidation = validateConsentResource(consent);
      if (!consentValidation.ok) {
        throw new Error(consentValidation.issues[0]?.message ?? 'Family-sharing consent is invalid.');
      }

      await FhirRepository.createConsent(consent);
    },
    onSuccess: (_data, variables) => {
      void Promise.all([
        qc.invalidateQueries({ queryKey: ['takt', 'family-sharing', 'consent', variables.patientRef] }),
        qc.invalidateQueries({ queryKey: ['takt', 'family-sharing', 'related-person', variables.patientRef] }),
      ]);
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

      const updated = buildFamilyShareRevokeConsent({
        consent: input.grant.consent,
        revokedByRef: input.revokedByRef,
      });
      return FhirRepository.updateConsent(consentId, updated);
    },
    onSuccess: (_data, variables) => {
      const patientRef = variables.grant.patientRef;
      void qc.invalidateQueries({ queryKey: ['takt', 'family-sharing', 'consent', patientRef] });
    },
  });
};

export const useViewerRole = (value: ViewerRole = 'patient'): ViewerRole => value;

export const familySharingRelativeIdFromGrant = (
  grant: FamilySharingGrant,
): string | undefined => refId(grant.relatedPersonRef);
