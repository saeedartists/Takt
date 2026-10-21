import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { TAKT_EXT } from '../src/domain/constants.js';
import {
  buildDoseOccurrencesForDay,
  courseEnded,
  patientTimezone,
  readPlan,
} from '../src/domain/schedule.js';
import type {
  MedicationAdministrationResource,
  MedicationRequestResource,
  MedicationResource,
} from '../src/domain/types.js';

const zone = 'Europe/Berlin';

const medication: MedicationResource = {
  resourceType: 'Medication',
  id: 'med-1',
  code: { text: 'Metformin 500 mg' },
  form: { text: 'Tablet' },
  extension: [{ url: TAKT_EXT.strength, valueString: '500 mg' }],
};

const request = (overrides: Partial<MedicationRequestResource> = {}): MedicationRequestResource => ({
  resourceType: 'MedicationRequest',
  id: 'req-1',
  status: 'active',
  subject: { reference: 'Patient/p-1' },
  medicationReference: { reference: 'Medication/med-1' },
  authoredOn: '2026-10-01T00:00:00Z',
  dosageInstruction: [
    {
      timing: {
        repeat: {
          frequency: 2,
          period: 1,
          periodUnit: 'd',
          timeOfDay: ['08:00:00', '20:00:00'],
        },
      },
    },
  ],
  ...overrides,
});

const administration = (
  scheduledAt: DateTime,
  status: 'completed' | 'not-done',
  reason?: string,
): MedicationAdministrationResource => ({
  resourceType: 'MedicationAdministration',
  id: `adm-${scheduledAt.toFormat('yyyy-MM-dd-HH-mm')}`,
  status,
  subject: { reference: 'Patient/p-1' },
  request: { reference: 'MedicationRequest/req-1' },
  medicationReference: { reference: 'Medication/med-1' },
  effectiveDateTime: scheduledAt.plus({ minutes: 5 }).toUTC().toISO() ?? undefined,
  extension: [{ url: TAKT_EXT.scheduledTime, valueDateTime: scheduledAt.toUTC().toISO() ?? undefined }],
  statusReason:
    status === 'not-done'
      ? [{ coding: [{ system: TAKT_EXT.skipReason, code: reason ?? 'forgot' }] }]
      : undefined,
});

describe('readPlan', () => {
  it('reads daily plans, strength, and sorted times', () => {
    const plan = readPlan(request(), medication, zone);
    expect(plan.label).toBe('Metformin 500 mg');
    expect(plan.strength).toBe('500 mg');
    expect(plan.times).toEqual(['08:00', '20:00']);
    expect(plan.cadence).toBe('daily');
  });

  it('treats multi-day periods as intervals but not multi-hour periods', () => {
    const everyOtherDay = readPlan(
      request({
        dosageInstruction: [
          {
            timing: { repeat: { frequency: 1, period: 2, periodUnit: 'd', timeOfDay: ['08:00'] } },
          },
        ],
      }),
      medication,
      zone,
    );
    expect(everyOtherDay.cadence).toBe('interval');
    expect(everyOtherDay.intervalDays).toBe(2);

    const everyEightHours = readPlan(
      request({
        dosageInstruction: [
          {
            timing: { repeat: { frequency: 3, period: 8, periodUnit: 'h', timeOfDay: ['08:00'] } },
          },
        ],
      }),
      medication,
      zone,
    );
    expect(everyEightHours.cadence).toBe('daily');

    const weekly = readPlan(
      request({
        dosageInstruction: [
          {
            timing: { repeat: { frequency: 1, period: 2, periodUnit: 'wk', timeOfDay: ['08:00'] } },
          },
        ],
      }),
      medication,
      zone,
    );
    expect(weekly.cadence).toBe('interval');
    expect(weekly.intervalDays).toBe(14);
  });

  it('reads date-only bounds as inclusive local dates', () => {
    const plan = readPlan(
      request({
        dosageInstruction: [
          {
            timing: {
              repeat: {
                frequency: 1,
                period: 1,
                periodUnit: 'd',
                timeOfDay: ['08:00'],
                boundsPeriod: { start: '2026-10-01', end: '2026-10-20' },
              },
            },
          },
        ],
      }),
      medication,
      zone,
    );

    expect(plan.endDate).toBe('2026-10-20');
    expect(courseEnded(plan, DateTime.fromISO('2026-10-20T23:00:00', { zone }), zone)).toBe(false);
    expect(courseEnded(plan, DateTime.fromISO('2026-10-21T00:00:00', { zone }), zone)).toBe(true);
  });

  it('falls back safely when a timezone extension is invalid', () => {
    expect(
      patientTimezone(
        {
          extension: [{ url: TAKT_EXT.patientTimezone, valueString: 'Not/AZone' }],
        },
        'Europe/Berlin',
      ),
    ).toBe('Europe/Berlin');
    expect(patientTimezone({}, 'Not/AZone')).toBe('UTC');
  });

  it('treats Monday-Friday as weekdays', () => {
    const plan = readPlan(
      request({
        dosageInstruction: [
          {
            timing: {
              repeat: {
                frequency: 1,
                period: 1,
                periodUnit: 'd',
                dayOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
                timeOfDay: ['09:00:00'],
              },
            },
          },
        ],
      }),
      medication,
      zone,
    );
    expect(plan.cadence).toBe('weekdays');
  });
});

describe('buildDoseOccurrencesForDay', () => {
  it('marks a recent dose due and a later dose scheduled', () => {
    const now = DateTime.fromISO('2026-10-20T09:00:00', { zone });
    const plan = readPlan(request(), medication, zone);
    const doses = buildDoseOccurrencesForDay([plan], [], now, now, zone);
    expect(doses.map((dose) => dose.state)).toEqual(['due', 'scheduled']);
    expect(doses[0]?.scheduledAt).toBe(
      DateTime.fromISO('2026-10-20T08:00:00', { zone }).toUTC().toISO(),
    );
  });

  it('uses the latest administration event for the matching scheduled time', () => {
    const now = DateTime.fromISO('2026-10-20T09:00:00', { zone });
    const morning = DateTime.fromISO('2026-10-20T08:00:00', { zone });
    const plan = readPlan(request(), medication, zone);
    const doses = buildDoseOccurrencesForDay(
      [plan],
      [administration(morning, 'completed')],
      now,
      now,
      zone,
    );
    expect(doses[0]?.state).toBe('taken');
  });

  it('records the skip reason', () => {
    const now = DateTime.fromISO('2026-10-20T09:00:00', { zone });
    const morning = DateTime.fromISO('2026-10-20T08:00:00', { zone });
    const plan = readPlan(request(), medication, zone);
    const doses = buildDoseOccurrencesForDay(
      [plan],
      [administration(morning, 'not-done', 'side-effects')],
      now,
      now,
      zone,
    );
    expect(doses[0]?.state).toBe('skipped');
    expect(doses[0]?.reasonCode).toBe('side-effects');
  });

  it('does not schedule weekday plans on weekends', () => {
    const saturday = DateTime.fromISO('2026-10-24T09:00:00', { zone });
    const plan = readPlan(
      request({
        dosageInstruction: [
          {
            timing: {
              repeat: {
                frequency: 1,
                period: 1,
                periodUnit: 'd',
                dayOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
                timeOfDay: ['09:00:00'],
              },
            },
          },
        ],
      }),
      medication,
      zone,
    );
    expect(buildDoseOccurrencesForDay([plan], [], saturday, saturday, zone)).toHaveLength(0);
  });

  it('suppresses doses inside a pause period', () => {
    const now = DateTime.fromISO('2026-10-20T09:00:00', { zone });
    const plan = readPlan(
      request({
        extension: [
          {
            url: TAKT_EXT.pauseHistory,
            valueString: JSON.stringify([
              {
                start: DateTime.fromISO('2026-10-20T00:00:00', { zone }).toUTC().toISO(),
              },
            ]),
          },
        ],
      }),
      medication,
      zone,
    );
    expect(buildDoseOccurrencesForDay([plan], [], now, now, zone)).toHaveLength(0);
  });

  it('suppresses doses for completed or cancelled requests', () => {
    const now = DateTime.fromISO('2026-10-20T09:00:00', { zone });
    const completed = readPlan(request({ status: 'completed' }), medication, zone);
    const cancelled = readPlan(request({ status: 'cancelled' }), medication, zone);
    expect(buildDoseOccurrencesForDay([completed], [], now, now, zone)).toHaveLength(0);
    expect(buildDoseOccurrencesForDay([cancelled], [], now, now, zone)).toHaveLength(0);
  });

  it('marks doses missed after the grace window', () => {
    const now = DateTime.fromISO('2026-10-20T13:00:00', { zone });
    const plan = readPlan(request(), medication, zone);
    const doses = buildDoseOccurrencesForDay([plan], [], now, now, zone);
    expect(doses[0]?.state).toBe('missed');
  });
});
