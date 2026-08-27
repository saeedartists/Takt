import { buildDoseOccurrencesForDay, buildHistory, localScheduledKey, resolveDoseState } from '../schedule';
import { atClockTime, startOfDay } from '../time';
import type { MedicationAdministrationResource, MedicationPlan, PausePeriod } from '../types';

type FixtureResult = {
  id: string;
  title: string;
  passed: boolean;
  details: string;
};

const createPlan = (id: string, params?: { createdAt?: string; pauseHistory?: PausePeriod[] }): MedicationPlan => ({
  request: {
    resourceType: 'MedicationRequest',
    id,
    status: 'active',
    intent: 'order',
    subject: { reference: 'Patient/p1' },
    medicationReference: { reference: `Medication/m-${id}` },
  },
  medication: {
    resourceType: 'Medication',
    id: `m-${id}`,
    code: { text: `Medication ${id}` },
  },
  label: `Medication ${id}`,
  form: 'Tablet',
  strength: '10 mg',
  times: ['08:00'],
  cadence: 'daily',
  dayOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  createdAt: params?.createdAt,
  pauseHistory: params?.pauseHistory ?? [],
});

const createEvent = (
  requestId: string,
  scheduledAt: Date,
  action: 'taken' | 'skipped' | 'missed',
): MedicationAdministrationResource => ({
  resourceType: 'MedicationAdministration',
  id: `e-${requestId}-${localScheduledKey(scheduledAt)}`,
  status: action === 'taken' ? 'completed' : 'not-done',
  subject: { reference: 'Patient/p1' },
  request: { reference: `MedicationRequest/${requestId}` },
  medicationReference: { reference: `Medication/m-${requestId}` },
  effectiveDateTime: new Date(scheduledAt.getTime() + 20 * 60 * 1000).toISOString(),
  extension: [
    {
      url: 'https://actimi.com/fhir/takt/scheduled-time',
      valueDateTime: scheduledAt.toISOString(),
    },
  ],
  statusReason:
    action === 'taken'
      ? undefined
      : [
          {
            coding: [
              {
                code: action === 'missed' ? 'not-available' : 'patient-refusal',
              },
            ],
          },
        ],
});

const countTotals = (history: ReturnType<typeof buildHistory>) =>
  history.reduce(
    (acc, day) => {
      acc.taken += day.taken;
      acc.skipped += day.skipped;
      acc.missed += day.missed;
      return acc;
    },
    { taken: 0, skipped: 0, missed: 0 },
  );

const pct = (taken: number, skipped: number, missed: number): number => {
  const denominator = taken + skipped + missed;
  return denominator === 0 ? 0 : Math.round((taken / denominator) * 100);
};

const fixtureOneMedication = (): FixtureResult => {
  const plan = { ...createPlan('r1'), times: ['08:00', '20:00'] };
  const jan9 = startOfDay(new Date('2026-01-09T00:00:00'));
  const jan10 = startOfDay(new Date('2026-01-10T00:00:00'));

  const events = [
    createEvent('r1', atClockTime(jan9, '08:00'), 'taken'),
    createEvent('r1', atClockTime(jan9, '20:00'), 'skipped'),
    createEvent('r1', atClockTime(jan10, '08:00'), 'taken'),
  ];

  const history = buildHistory([plan], events, 2, {
    today: jan10,
    now: new Date('2026-01-11T02:00:00'),
  });
  const totals = countTotals(history);
  const got = pct(totals.taken, totals.skipped, totals.missed);
  const expected = 50;

  return {
    id: 'fixture-1-med',
    title: '1 medication fixture (taken/skipped/missed mix)',
    passed: got === expected && totals.taken === 2 && totals.skipped === 1 && totals.missed === 1,
    details: `expected 50% from 2/4, got ${got}% from taken=${totals.taken}, skipped=${totals.skipped}, missed=${totals.missed}`,
  };
};

const fixtureSixMedication = (): FixtureResult => {
  const day = startOfDay(new Date('2026-01-10T00:00:00'));
  const plans = Array.from({ length: 6 }, (_, i) => createPlan(`s${i + 1}`));

  const events: MedicationAdministrationResource[] = [
    createEvent('s1', atClockTime(day, '08:00'), 'taken'),
    createEvent('s2', atClockTime(day, '08:00'), 'taken'),
    createEvent('s3', atClockTime(day, '08:00'), 'taken'),
    createEvent('s4', atClockTime(day, '08:00'), 'taken'),
    createEvent('s5', atClockTime(day, '08:00'), 'skipped'),
  ];

  const history = buildHistory(plans, events, 1, {
    today: day,
    now: new Date('2026-01-10T14:30:00'),
  });
  const totals = countTotals(history);
  const got = pct(totals.taken, totals.skipped, totals.missed);
  const expected = 67;

  return {
    id: 'fixture-6-med',
    title: '6 medication fixture',
    passed: got === expected && totals.taken === 4 && totals.skipped === 1 && totals.missed === 1,
    details: `expected 67% from 4/6, got ${got}% from taken=${totals.taken}, skipped=${totals.skipped}, missed=${totals.missed}`,
  };
};

const fixtureTwentyMedication = (): FixtureResult => {
  const day = startOfDay(new Date('2026-01-10T00:00:00'));
  const plans = Array.from({ length: 20 }, (_, i) => createPlan(`t${i + 1}`));
  const events: MedicationAdministrationResource[] = [];

  for (let i = 1; i <= 12; i += 1) {
    events.push(createEvent(`t${i}`, atClockTime(day, '08:00'), 'taken'));
  }
  for (let i = 13; i <= 17; i += 1) {
    events.push(createEvent(`t${i}`, atClockTime(day, '08:00'), 'skipped'));
  }

  const history = buildHistory(plans, events, 1, {
    today: day,
    now: new Date('2026-01-10T14:30:00'),
  });
  const totals = countTotals(history);
  const got = pct(totals.taken, totals.skipped, totals.missed);
  const expected = 60;

  return {
    id: 'fixture-20-med',
    title: '20 medication fixture',
    passed: got === expected && totals.taken === 12 && totals.skipped === 5 && totals.missed === 3,
    details: `expected 60% from 12/20, got ${got}% from taken=${totals.taken}, skipped=${totals.skipped}, missed=${totals.missed}`,
  };
};

const fixtureMidDayAddFutureOnly = (): FixtureResult => {
  const day = startOfDay(new Date('2026-01-10T00:00:00'));
  const plan = {
    ...createPlan('midday', { createdAt: '2026-01-10T13:00:00.000Z' }),
    times: ['08:00', '20:00'],
  };

  const doses = buildDoseOccurrencesForDay([plan], [], day, new Date('2026-01-10T14:00:00'));
  const hasMorningDose = doses.some((dose) => dose.scheduledAt.getHours() === 8);
  const hasEveningDose = doses.some((dose) => dose.scheduledAt.getHours() === 20);

  return {
    id: 'edge-midday-add',
    title: 'Mid-day add creates future doses only',
    passed: !hasMorningDose && hasEveningDose,
    details: `morning dose present=${hasMorningDose.toString()}, evening dose present=${hasEveningDose.toString()}`,
  };
};

const fixturePauseExclusion = (): FixtureResult => {
  const day = startOfDay(new Date('2026-01-10T00:00:00'));
  const plan = createPlan('pause', {
    pauseHistory: [{ start: '2026-01-09T00:00:00.000Z', end: '2026-01-11T00:00:00.000Z' }],
  });

  const history = buildHistory([plan], [], 1, {
    today: day,
    now: new Date('2026-01-10T18:00:00'),
  });
  const totals = countTotals(history);
  const denominator = totals.taken + totals.skipped + totals.missed;

  return {
    id: 'edge-pause-exclusion',
    title: 'Paused period excluded from denominator',
    passed: denominator === 0,
    details: `expected denominator=0, got ${denominator}`,
  };
};

const fixtureStateMachineBoundaries = (): FixtureResult => {
  const scheduledAt = new Date('2026-01-10T08:00:00');
  const scheduled = resolveDoseState(scheduledAt, new Date('2026-01-10T07:50:00'));
  const due = resolveDoseState(scheduledAt, new Date('2026-01-10T10:00:00'));
  const missed = resolveDoseState(scheduledAt, new Date('2026-01-10T12:01:00'));

  return {
    id: 'edge-state-machine',
    title: 'State machine transitions scheduled → due → missed',
    passed: scheduled === 'scheduled' && due === 'due' && missed === 'missed',
    details: `scheduled=${scheduled}, due=${due}, missed=${missed}`,
  };
};

const fixtureParallelDoseIsolation = (): FixtureResult => {
  const day = startOfDay(new Date('2026-01-10T00:00:00'));
  const a = { ...createPlan('parallel-a'), times: ['09:00'] };
  const b = { ...createPlan('parallel-b'), times: ['09:00'] };

  const events = [createEvent('parallel-a', atClockTime(day, '09:00'), 'taken')];
  const doses = buildDoseOccurrencesForDay([a, b], events, day, new Date('2026-01-10T15:00:00'));
  const states = doses.map((dose) => `${dose.requestId}:${dose.state}`).sort();

  return {
    id: 'edge-parallel-doses',
    title: 'Same-time doses remain independent per medication request',
    passed: states.includes('parallel-a:taken') && states.includes('parallel-b:missed'),
    details: states.join(', '),
  };
};

export const runAdherenceFixtureSuite = (): { passed: boolean; results: FixtureResult[] } => {
  const results = [
    fixtureOneMedication(),
    fixtureSixMedication(),
    fixtureTwentyMedication(),
    fixtureMidDayAddFutureOnly(),
    fixturePauseExclusion(),
    fixtureStateMachineBoundaries(),
    fixtureParallelDoseIsolation(),
  ];

  return {
    passed: results.every((result) => result.passed),
    results,
  };
};
