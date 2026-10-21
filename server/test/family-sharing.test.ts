import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  FAMILY_SHARE_UNCONFIRMED_HOURS,
  TAKT_EXT,
} from '../src/domain/constants.js';
import {
  buildFamilyShareTodayView,
  isActiveFamilyShare,
  selectUnconfirmedDoses,
} from '../src/domain/family-sharing.js';
import type {
  ConsentResource,
  DoseOccurrence,
  PatientResource,
  RelatedPersonResource,
} from '../src/domain/types.js';

const zone = 'Europe/Berlin';

const patient: PatientResource = {
  resourceType: 'Patient',
  id: 'p-1',
  name: [{ given: ['Ada'], family: 'Lovelace' }],
};

const relatedPerson = (linkedAccount = 'Patient/relative-1'): RelatedPersonResource => ({
  resourceType: 'RelatedPerson',
  id: 'rp-1',
  active: true,
  patient: { reference: 'Patient/p-1' },
  telecom: [{ system: 'email', value: 'relative@example.com' }],
  extension: [{ url: TAKT_EXT.familyShareLinkedAccount, valueString: linkedAccount }],
});

const consent = (overrides: Partial<ConsentResource> = {}): ConsentResource => ({
  resourceType: 'Consent',
  id: 'consent-1',
  status: 'active',
  patient: { reference: 'Patient/p-1' },
  dateTime: '2026-10-01T10:00:00Z',
  policyRule: { text: 'takt-family-sharing-v1' },
  provision: {
    type: 'permit',
    actor: [{ reference: { reference: 'RelatedPerson/rp-1' } }],
  },
  ...overrides,
});

const dose = (
  id: string,
  scheduledAt: DateTime,
  state: DoseOccurrence['state'],
): DoseOccurrence => ({
  id,
  requestId: 'req-1',
  label: 'Metformin 500 mg',
  scheduledAt: scheduledAt.toUTC().toISO() ?? '',
  state,
});

describe('isActiveFamilyShare', () => {
  it('accepts an active consent for the linked relative account', () => {
    expect(isActiveFamilyShare(consent(), relatedPerson(), 'Patient/relative-1')).toBe(true);
  });

  it('rejects revoked consent and mismatched linked accounts', () => {
    expect(isActiveFamilyShare(consent({ status: 'inactive' }), relatedPerson(), 'Patient/relative-1')).toBe(
      false,
    );
    expect(isActiveFamilyShare(consent(), relatedPerson('Patient/other'), 'Patient/relative-1')).toBe(false);
  });

  it('rejects a consent for a different actor', () => {
    expect(
      isActiveFamilyShare(
        consent({ provision: { type: 'permit', actor: [{ reference: { reference: 'RelatedPerson/other' } }] } }),
        relatedPerson(),
        'Patient/relative-1',
      ),
    ).toBe(false);
  });
});

describe('buildFamilyShareTodayView', () => {
  it('returns only dose status and keeps advanced capabilities blocked', () => {
    const now = DateTime.fromISO('2026-10-20T10:00:00', { zone });
    const view = buildFamilyShareTodayView(
      patient,
      'Patient/p-1',
      [dose('dose-1', DateTime.fromISO('2026-10-20T08:00:00', { zone }), 'due')],
      now,
      zone,
    );
    expect(view.patientLabel).toBe('Ada Lovelace');
    expect(view.doses[0]?.status).toBe('due');
    expect(view.doses[0]?.unconfirmedForHours).toBe(2);
    expect(view.blocked).toContain('edit-regimen');
    expect(view.blocked).toContain('view-diary');
    expect(view.blocked).toContain('export-doctor-report');
  });
});

describe('selectUnconfirmedDoses', () => {
  const now = DateTime.fromISO('2026-10-20T10:00:00', { zone });

  it('selects due doses older than the threshold', () => {
    const doses = [
      dose('old', DateTime.fromISO('2026-10-20T06:00:00', { zone }), 'due'),
      dose('fresh', DateTime.fromISO('2026-10-20T09:30:00', { zone }), 'due'),
      dose('taken', DateTime.fromISO('2026-10-20T05:00:00', { zone }), 'taken'),
    ];
    const selected = selectUnconfirmedDoses(doses, now, { zone });
    expect(selected.map((item) => item.id)).toEqual(['old']);
    expect(FAMILY_SHARE_UNCONFIRMED_HOURS).toBe(2);
  });

  it('respects quiet hours', () => {
    const quietNow = DateTime.fromISO('2026-10-20T22:30:00', { zone });
    const doses = [dose('old', DateTime.fromISO('2026-10-20T18:00:00', { zone }), 'due')];
    expect(selectUnconfirmedDoses(doses, quietNow, { zone, quietHours: {} })).toHaveLength(0);
    expect(
      selectUnconfirmedDoses(doses, quietNow, { zone, quietHours: { startHour: 23, endHour: 7 } }),
    ).toHaveLength(1);
  });
});
