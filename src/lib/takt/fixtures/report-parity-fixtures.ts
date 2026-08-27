import { buildReportSummary } from '../report-summary';
import { buildHistory, localScheduledKey } from '../schedule';
import { atClockTime, startOfDay } from '../time';
import type { MedicationAdministrationResource, MedicationPlan } from '../types';

type FixtureResult = {
  id: string;
  title: string;
  passed: boolean;
  details: string;
};

const createPlan = (id: string): MedicationPlan => ({
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
  pauseHistory: [],
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
  effectiveDateTime: new Date(scheduledAt.getTime() + 5 * 60 * 1000).toISOString(),
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

const runScenario = (input: {
  id: string;
  title: string;
  plans: MedicationPlan[];
  events: MedicationAdministrationResource[];
  days: number;
  today: Date;
  now: Date;
  expectedPct: number;
  expectedTotalMissed: number;
}) => {
  const history = buildHistory(input.plans, input.events, input.days, {
    today: input.today,
    now: input.now,
  });

  const report = buildReportSummary({
    plans: input.plans,
    history,
    formatMissedDateTime: (value) => value.toISOString(),
  });

  const historyTaken = history.reduce((sum, day) => sum + day.taken, 0);
  const historyDenominator = history.reduce((sum, day) => sum + day.taken + day.skipped + day.missed, 0);
  const historyPct = historyDenominator > 0 ? Math.round((historyTaken / historyDenominator) * 100) : 0;

  const passed =
    report.pct === input.expectedPct &&
    report.pct === historyPct &&
    report.missedRows.length === input.expectedTotalMissed;

  return {
    id: input.id,
    title: input.title,
    passed,
    details: `report=${report.pct}% history=${historyPct}% missedRows=${report.missedRows.length} expectedMissed=${input.expectedTotalMissed}`,
  } satisfies FixtureResult;
};

export const runReportParityFixtureSuite = (): { passed: boolean; results: FixtureResult[] } => {
  const day = startOfDay(new Date('2026-01-10T00:00:00'));

  const onePlan = { ...createPlan('one'), times: ['08:00', '20:00'] };
  const oneEvents = [
    createEvent('one', atClockTime(startOfDay(new Date('2026-01-09T00:00:00')), '08:00'), 'taken'),
    createEvent('one', atClockTime(startOfDay(new Date('2026-01-09T00:00:00')), '20:00'), 'skipped'),
    createEvent('one', atClockTime(day, '08:00'), 'taken'),
  ];

  const sixPlans = Array.from({ length: 6 }, (_, i) => createPlan(`six-${i + 1}`));
  const sixEvents: MedicationAdministrationResource[] = [
    createEvent('six-1', atClockTime(day, '08:00'), 'taken'),
    createEvent('six-2', atClockTime(day, '08:00'), 'taken'),
    createEvent('six-3', atClockTime(day, '08:00'), 'taken'),
    createEvent('six-4', atClockTime(day, '08:00'), 'taken'),
    createEvent('six-5', atClockTime(day, '08:00'), 'skipped'),
  ];

  const twentyPlans = Array.from({ length: 20 }, (_, i) => createPlan(`twenty-${i + 1}`));
  const twentyEvents: MedicationAdministrationResource[] = [];
  for (let i = 1; i <= 12; i += 1) {
    twentyEvents.push(createEvent(`twenty-${i}`, atClockTime(day, '08:00'), 'taken'));
  }
  for (let i = 13; i <= 17; i += 1) {
    twentyEvents.push(createEvent(`twenty-${i}`, atClockTime(day, '08:00'), 'skipped'));
  }

  const results = [
    runScenario({
      id: 'report-1-med-parity',
      title: 'Report parity: 1 medication scenario',
      plans: [onePlan],
      events: oneEvents,
      days: 2,
      today: day,
      now: new Date('2026-01-11T02:00:00'),
      expectedPct: 50,
      expectedTotalMissed: 1,
    }),
    runScenario({
      id: 'report-6-med-parity',
      title: 'Report parity: 6 medication scenario',
      plans: sixPlans,
      events: sixEvents,
      days: 1,
      today: day,
      now: new Date('2026-01-10T14:30:00'),
      expectedPct: 67,
      expectedTotalMissed: 1,
    }),
    runScenario({
      id: 'report-20-med-parity',
      title: 'Report parity: 20 medication scenario',
      plans: twentyPlans,
      events: twentyEvents,
      days: 1,
      today: day,
      now: new Date('2026-01-10T14:30:00'),
      expectedPct: 60,
      expectedTotalMissed: 3,
    }),
  ];

  return {
    passed: results.every((result) => result.passed),
    results,
  };
};
