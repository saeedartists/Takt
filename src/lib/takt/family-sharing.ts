import { TAKT_EXT } from './constants';
import type {
  ConsentResource,
  DoseOccurrence,
  FamilySharingGrant,
  FhirExtension,
  FhirReference,
  RelatedPersonResource,
} from './types';

export type ViewerRole = 'patient' | 'relative';

export type RelativePermission =
  | 'view-today-doses'
  | 'view-dose-status'
  | 'receive-unconfirmed-reminder'
  | 'edit-regimen'
  | 'view-diary'
  | 'export-doctor-report';

const PERMISSIONS: Record<ViewerRole, RelativePermission[]> = {
  patient: [
    'view-today-doses',
    'view-dose-status',
    'receive-unconfirmed-reminder',
    'edit-regimen',
    'view-diary',
    'export-doctor-report',
  ],
  relative: ['view-today-doses', 'view-dose-status', 'receive-unconfirmed-reminder'],
};

export const canUsePermission = (role: ViewerRole, permission: RelativePermission): boolean =>
  PERMISSIONS[role].includes(permission);

type WithExtensions = { extension?: FhirExtension[] };

const ext = (resource: WithExtensions, url: string): FhirExtension | undefined =>
  resource.extension?.find((item) => item.url === url);
const extString = (resource: WithExtensions, url: string): string | undefined => ext(resource, url)?.valueString;
const extDateTime = (resource: WithExtensions, url: string): string | undefined => ext(resource, url)?.valueDateTime;

const parseRelatedPersonRef = (consent: ConsentResource): string | undefined =>
  consent.provision?.actor?.[0]?.reference?.reference;

const labelFromRelatedPerson = (relatedPerson?: RelatedPersonResource): string => {
  const name = relatedPerson?.name?.[0];
  const joined = `${name?.given?.join(' ') ?? ''} ${name?.family ?? ''}`.trim();
  if (joined) return joined;
  return 'Relative';
};

const parseRefId = (ref?: string): string | undefined => ref?.split('/')[1];

export const FAMILY_SHARING_POLICY_VERSION = 'takt-family-sharing-v1';

/** Brief §11: one quiet notice when a dose is still unconfirmed two hours after its time. */
export const UNCONFIRMED_ALERT_HOURS = 2;

export const relatedPersonEmail = (relatedPerson?: RelatedPersonResource): string | undefined =>
  relatedPerson?.telecom?.find((entry) => entry.system === 'email')?.value?.trim().toLowerCase();

export const relatedPersonLinkedAccount = (relatedPerson?: RelatedPersonResource): string | undefined =>
  relatedPerson ? extString(relatedPerson, TAKT_EXT.familyShareLinkedAccount) : undefined;

export const relatedPersonAcceptedAt = (relatedPerson?: RelatedPersonResource): string | undefined =>
  relatedPerson ? extDateTime(relatedPerson, TAKT_EXT.familyShareAcceptedAt) : undefined;

export const isFamilyShareConsent = (consent: ConsentResource): boolean =>
  extString(consent, TAKT_EXT.familyShareGrant) === 'true';

/**
 * The relative accepts on their own account. The link lives on the
 * RelatedPerson (the patient's record), never as a copy of patient data
 * in the relative's account — brief §11 consent obligation.
 */
export const buildRelatedPersonAcceptance = (
  relatedPerson: RelatedPersonResource,
  accountRef: string,
  acceptedAt = new Date().toISOString(),
): RelatedPersonResource => ({
  ...relatedPerson,
  active: true,
  extension: [
    ...(relatedPerson.extension ?? []).filter(
      (item) => item.url !== TAKT_EXT.familyShareLinkedAccount && item.url !== TAKT_EXT.familyShareAcceptedAt,
    ),
    { url: TAKT_EXT.familyShareLinkedAccount, valueString: accountRef },
    { url: TAKT_EXT.familyShareAcceptedAt, valueDateTime: acceptedAt },
  ],
});

/** Unconfirmed = neither taken nor explicitly skipped, `hours` after the scheduled time. */
export const isUnconfirmedForHours = (
  dose: DoseOccurrence,
  now = new Date(),
  hours = UNCONFIRMED_ALERT_HOURS,
): boolean =>
  dose.state !== 'taken' &&
  dose.state !== 'skipped' &&
  now.getTime() - dose.scheduledAt.getTime() >= hours * 60 * 60 * 1000;

export const buildFamilyShareConsent = (input: {
  patientRef: string;
  relatedPersonRef: string;
  relationshipCode?: string;
  grantedByRef: FhirReference;
  grantedAt?: string;
}): ConsentResource => {
  const grantedAt = input.grantedAt ?? new Date().toISOString();

  return {
    resourceType: 'Consent',
    status: 'active',
    patient: { reference: input.patientRef },
    dateTime: grantedAt,
    scope: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/consentscope',
          code: 'patient-privacy',
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: 'http://loinc.org',
            code: '59284-0',
            display: 'Patient Consent',
          },
        ],
      },
    ],
    policyRule: {
      text: FAMILY_SHARING_POLICY_VERSION,
    },
    provision: {
      type: 'permit',
      actor: [
        {
          role: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                code: 'IRCP',
                display: 'information recipient',
              },
            ],
          },
          reference: { reference: input.relatedPersonRef },
        },
      ],
    },
    extension: [
      {
        url: TAKT_EXT.familyShareGrant,
        valueString: 'true',
      },
      {
        url: TAKT_EXT.familyShareGrantedAt,
        valueDateTime: grantedAt,
      },
      {
        url: TAKT_EXT.familyShareGrantedBy,
        valueString: input.grantedByRef.reference,
      },
      ...(input.relationshipCode
        ? [
            {
              url: TAKT_EXT.familyShareRelationshipCode,
              valueString: input.relationshipCode,
            },
          ]
        : []),
    ],
  };
};

export const buildFamilyShareRevokeConsent = (input: {
  consent: ConsentResource;
  revokedAt?: string;
  revokedByRef: FhirReference;
}): ConsentResource => {
  const revokedAt = input.revokedAt ?? new Date().toISOString();
  const base = input.consent.extension ?? [];

  const withoutRevocation = base.filter(
    (item) => item.url !== TAKT_EXT.familyShareRevokedAt && item.url !== TAKT_EXT.familyShareRevokedBy,
  );

  return {
    ...input.consent,
    status: 'inactive',
    extension: [
      ...withoutRevocation,
      {
        url: TAKT_EXT.familyShareRevokedAt,
        valueDateTime: revokedAt,
      },
      {
        url: TAKT_EXT.familyShareRevokedBy,
        valueString: input.revokedByRef.reference,
      },
    ],
  };
};

export const toFamilySharingGrant = (
  consent: ConsentResource,
  relatedPeopleById: Map<string, RelatedPersonResource>,
): FamilySharingGrant | null => {
  if (!isFamilyShareConsent(consent)) return null;

  const relatedPersonRef = parseRelatedPersonRef(consent);
  const relatedPersonId = parseRefId(relatedPersonRef);
  if (!relatedPersonRef || !relatedPersonId) return null;

  const relatedPerson = relatedPeopleById.get(relatedPersonId);
  const grantedAt = extDateTime(consent, TAKT_EXT.familyShareGrantedAt) ?? consent.dateTime;
  const revokedAt = extDateTime(consent, TAKT_EXT.familyShareRevokedAt);

  return {
    id: consent.id ?? `${relatedPersonRef}-${grantedAt}`,
    patientRef: consent.patient.reference,
    relatedPersonRef,
    relatedPersonLabel: labelFromRelatedPerson(relatedPerson),
    relationshipCode: extString(consent, TAKT_EXT.familyShareRelationshipCode),
    email: relatedPersonEmail(relatedPerson),
    linkedAccountRef: relatedPersonLinkedAccount(relatedPerson),
    acceptedAt: relatedPersonAcceptedAt(relatedPerson),
    grantedAt,
    revokedAt,
    status: consent.status === 'active' ? 'granted' : 'revoked',
    consent,
  };
};

export const familySharingLockedCapabilities = [
  'edit-regimen',
  'view-diary',
  'export-doctor-report',
] as const satisfies readonly RelativePermission[];
