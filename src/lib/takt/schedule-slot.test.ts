import { describe, expect, it } from 'vitest';

import { TAKT_EXT } from './constants';
import { addDays, atClockTime, isoDateKey } from './time';
import type { MedicationAdministrationResource, MedicationPlan } from './types';
import { buildDoseOccurrencesForDay, buildHistory } from './schedule';

const DAY = new Date(2026, 0, 15, 12, 0, 0);

const plan = (times: string[], overrides: Partial<MedicationPlan> = {}): MedicationPlan => ({
  request: {
    resourceType: 'MedicationRequest',
    id: 'r1',
    status: 'active',
    intent: 'order',
    subject: { reference: 'Patient/p1' },
  },
  medication: null,
  label: 'Ramipril',
  form: 'Tablet',
  strength: '5 mg',
  times,
  cadence: 'daily',
  dayOfWeek: [],
  pauseHistory: [],
  ...overrides,
});

const administration = (input: {
  id: string;
  scheduledTime: Date;
  planSlot?: string;
  status?: MedicationAdministrationResource['status'];
}): MedicationAdministrationResource => ({
  resourceType: 'MedicationAdministration',
  id: input.id,
  status: input.status ?? 'completed',
  subject: { reference: 'Patient/p1' },
  request: { reference: 'MedicationRequest/r1' },
  effectiveDateTime: input.scheduledTime.toISOString(),
  extension: [
    { url: TAKT_EXT.scheduledTime, valueDateTime: input.scheduledTime.toISOString() },
    ...(input.planSlot ? [{ url: TAKT_EXT.planSlot, valueString: input.planSlot }] : []),
  ],
});

describe('plan-slot dose matching', () => {
  it('matches a frozen plan slot even when the stored instant maps to another local wall time', () => {
    // A relative views from another timezone (or the clock crossed a DST shift):
    // the recorded instant shows up at 09:30 local wall, but the recording device
    // froze it as the 04:00 slot of the same calendar day. Slot identity, set at
    // record time, must win over the viewer's own local wall key.
    const foreign = administration({
      id: 'event-a',
      scheduledTime: atClockTime(DAY, '09:30'),
      planSlot: `r1|${isoDateKey(DAY)}|04:00`,
    });

    const doses = buildDoseOccurrencesForDay([plan(['04:00'])], [foreign], DAY);
    expect(doses).toHaveLength(1);
    expect(doses[0].state).toBe('taken');
    expect(doses[0].eventId).toBe('event-a');
  });

  it('falls back to the local wall key for legacy events without a slot', () => {
    const legacy = administration({
      id: 'event-legacy',
      scheduledTime: atClockTime(DAY, '04:00'),
    });

    const doses = buildDoseOccurrencesForDay([plan(['04:00'])], [legacy], DAY);
    expect(doses).toHaveLength(1);
    expect(doses[0].state).toBe('taken');
    expect(doses[0].eventId).toBe('event-legacy');
  });

  it('a slotted event never claims a different occurrence of the same day', () => {
    const foreign = administration({
      id: 'event-a',
      scheduledTime: atClockTime(DAY, '09:30'),
      planSlot: `r1|${isoDateKey(DAY)}|02:00`,
    });

    const doses = buildDoseOccurrencesForDay([plan(['02:00', '04:00'])], [foreign], DAY);
    const atTwo = doses.find((d) => d.scheduledAt.getHours() === 2);
    const atFour = doses.find((d) => d.scheduledAt.getHours() === 4);
    expect(atTwo?.state).toBe('taken');
    expect(atTwo?.eventId).toBe('event-a');
    expect(atFour?.eventId).toBeUndefined();
    expect(atFour?.state).toBe('missed');
  });

  it('buildHistory matches the same events through the dedicated day builder', () => {
    const recorded = administration({
      id: 'event-b',
      scheduledTime: atClockTime(DAY, '22:00'),
      planSlot: `r1|${isoDateKey(DAY)}|08:00`,
    });

    const rows = buildHistory([plan(['08:00'])], [recorded], 3, { today: DAY, now: atClockTime(DAY, '23:30') });
    const day = rows.find((row) => row.key === isoDateKey(DAY));
    expect(day?.taken).toBe(1);
    expect(day?.missed).toBe(0);
  });

  it('keeps the latest event when the slot is recorded twice (skip then taken)', () => {
    const skipped = administration({
      id: 'event-old',
      scheduledTime: atClockTime(DAY, '09:30'),
      planSlot: `r1|${isoDateKey(DAY)}|04:00`,
      status: 'not-done',
    });
    const taken = administration({
      id: 'event-new',
      scheduledTime: atClockTime(new Date(DAY.getTime() + 60_000), '09:30'),
      planSlot: `r1|${isoDateKey(DAY)}|04:00`,
    });

    const doses = buildDoseOccurrencesForDay([plan(['04:00'])], [skipped, taken], DAY);
    expect(doses[0].state).toBe('taken');
    expect(doses[0].eventId).toBe('event-new');
  });

  it('no calendar drift between the occurrence day and the frozen slot date', () => {
    const lateNight = administration({
      id: 'event-c',
      scheduledTime: atClockTime(addDays(DAY, 1), '00:05'),
      planSlot: `r1|${isoDateKey(addDays(DAY, 1))}|00:05`,
    });

    const doses = buildDoseOccurrencesForDay([plan(['00:05'])], [lateNight], addDays(DAY, 1));
    expect(doses).toHaveLength(1);
    expect(doses[0].state).toBe('taken');
    expect(doses[0].eventId).toBe('event-c');
  });
});
