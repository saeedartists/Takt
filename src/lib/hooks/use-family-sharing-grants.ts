'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FhirRepository } from '@/lib/takt/fhir-repository';
import {
  buildFamilyShareConsent,
  buildFamilyShareRevokeConsent,
  buildRelatedPersonAcceptance,
  isFamilyShareConsent,
  relatedPersonLinkedAccount,
  toFamilySharingGrant,
  type ViewerRole,
} from '@/lib/takt/family-sharing';
import {
  validateConsentResource,
  validateRelatedPersonResource,
} from '@/lib/takt/fhir-validation';
import type {
  ConsentResource,
  FamilySharingGrant,
  PatientResource,
  RelatedPersonResource,
} from '@/lib/takt/types';
import { usePrimaryPatient } from './use-primary-patient';

const refId = (value?: string): string | undefined => value?.split('/')[1];

const relationshipCoding = (relationshipCode: string) => ({
  system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
  code: relationshipCode,
  display:
    relationshipCode === 'SPS' ? 'spouse' : relationshipCode === 'CGV' ? 'caregiver' : 'relative',
});

/* ------------------------------------------------------------------ */
/* Patient side: grants this patient has given                         */
/* ------------------------------------------------------------------ */

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

/** Invite a relative by e-mail: one RelatedPerson plus one explicit, revocable Consent. */
export const useGrantFamilySharing = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      patientRef: string;
      givenName: string;
      familyName: string;
      relationshipCode: string;
      email: string;
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
        telecom: [{ system: 'email', use: 'home', value: input.email.trim().toLowerCase() }],
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

/* ------------------------------------------------------------------ */
/* Relative side: patients who shared with this account                */
/* ------------------------------------------------------------------ */

export type SharedPatient = {
  relatedPerson: RelatedPersonResource;
  consent: ConsentResource;
  patientRef: string;
  patientLabel: string;
  /** 'invited' until this account accepts; 'accepted' once linked; 'revoked' when the patient withdrew. */
  status: 'invited' | 'accepted' | 'revoked';
};

const SHARED_WITH_ME_KEY = ['takt', 'family-sharing', 'shared-with-me'] as const;

const patientLabel = (patient: PatientResource | null): string => {
  const name = patient?.name?.[0];
  return `${name?.given?.join(' ') ?? ''} ${name?.family ?? ''}`.trim() || 'Patient';
};

/** The e-mail this account signs in with; invitations are addressed to it. */
export const useAccountEmail = (): string | undefined => {
  const patient = usePrimaryPatient();
  return patient.data?.telecom?.find((entry) => entry.system === 'email')?.value?.trim().toLowerCase();
};

/**
 * Grants addressed to this account's e-mail, across all patients.
 * A grant on the account's own patient is a preview, not a share, and is skipped.
 */
export const useSharedWithMe = (email?: string, ownPatientRef?: string) =>
  useQuery<SharedPatient[]>({
    enabled: Boolean(email),
    queryKey: [...SHARED_WITH_ME_KEY, email],
    queryFn: async () => {
      const people = await FhirRepository.searchRelatedPeople(`email=${encodeURIComponent(email ?? '')}&_count=50`);
      const rows: SharedPatient[] = [];

      for (const { resource: relatedPerson } of people.entry ?? []) {
        if (!relatedPerson.id || relatedPerson.patient.reference === ownPatientRef) continue;

        const consents = await FhirRepository.searchConsents(
          `patient=${encodeURIComponent(relatedPerson.patient.reference)}&_count=200&_sort=-date`,
        );
        const consent = (consents.entry ?? [])
          .map((entry) => entry.resource)
          .find(
            (item) =>
              isFamilyShareConsent(item) &&
              item.provision?.actor?.[0]?.reference?.reference === `RelatedPerson/${relatedPerson.id}`,
          );
        if (!consent) continue;

        const patientId = refId(relatedPerson.patient.reference);
        const patient = patientId ? await FhirRepository.readPatient(patientId).catch(() => null) : null;

        rows.push({
          relatedPerson,
          consent,
          patientRef: relatedPerson.patient.reference,
          patientLabel: patientLabel(patient),
          status:
            consent.status !== 'active'
              ? 'revoked'
              : relatedPersonLinkedAccount(relatedPerson)
                ? 'accepted'
                : 'invited',
        });
      }

      return rows;
    },
  });

export const useAcceptSharedInvite = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { share: SharedPatient; accountRef: string }) => {
      const relatedPerson = input.share.relatedPerson;
      if (!relatedPerson.id) throw new Error('Invitation has no id.');
      return FhirRepository.updateRelatedPerson(
        relatedPerson.id,
        buildRelatedPersonAcceptance(relatedPerson, input.accountRef),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SHARED_WITH_ME_KEY });
    },
  });
};

export const useViewerRole = (value: ViewerRole = 'patient'): ViewerRole => value;

export const familySharingRelativeIdFromGrant = (
  grant: FamilySharingGrant,
): string | undefined => refId(grant.relatedPersonRef);
