import { en } from '../src/lib/takt/locales/en';
import { de } from '../src/lib/takt/locales/de';
import {
  DOSAGE_UNIT_OPTIONS,
  EMPTY_MEDICATION_FORM,
  MEDICATION_UNIT_LABELS,
  STRENGTH_UNIT_OPTIONS,
  formatStrength,
  parseDosageQuantity,
  scheduleFieldsFromForm,
  splitDosage,
  splitStrength,
  validateMedicationForm,
} from '../src/lib/takt/medication-form';
import { parseDateOnly } from '../src/lib/takt/schedule';
import type { MedicationFormValues } from '../src/lib/takt/medication-form';

type Check = { id: string; title: string; passed: boolean; details: string };

const t = (key: string) => key;
const values = (patch: Partial<MedicationFormValues>): MedicationFormValues => ({
  ...EMPTY_MEDICATION_FORM,
  name: 'Test',
  ...patch,
});

const checks: Check[] = [];
const record = (id: string, title: string, passed: boolean, details: string): void => {
  checks.push({ id, title, passed, details });
};

const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// --- strength ---
const strengthCases: [string, { strength: string; unit: string }][] = [
  ['5 mg', { strength: '5', unit: 'mg' }],
  ['1000 IU', { strength: '1000 IU', unit: '' }],
  ['', { strength: '', unit: '' }],
  ['5', { strength: '5', unit: '' }],
];
const strengthOk = strengthCases.every(([raw, expected]) => eq(splitStrength(raw), expected));
record('form.split-strength', 'splitStrength separates bare numbers from typed values', strengthOk, strengthCases.map(([raw]) => `${JSON.stringify(raw)}→${JSON.stringify(splitStrength(raw))}`).join('; '));

const formatCases: [[string, string], string][] = [
  [['5', 'mg'], '5 mg'],
  [['1000 IU', 'mg'], '1000 IU'],
  [['', 'mg'], ''],
];
const formatOk = formatCases.every(([[strength, unit], expected]) => formatStrength(strength, unit as never) === expected);
record('form.format-strength', 'formatStrength appends the unit only to bare numbers', formatOk, formatCases.map(([[s, u], e]) => `${s}+${u}→${formatStrength(s, u as never)} (want ${e})`).join('; '));

const roundTrip = eq(splitStrength(formatStrength('5', 'mg')), { strength: '5', unit: 'mg' }) && eq(splitStrength(formatStrength('1000 IU', 'mg')), { strength: '1000 IU', unit: '' });
record('form.strength-round-trip', 'format ∘ split is the identity for stored strengths', roundTrip, `'5 mg' and '1000 IU' survive edit round trips`);

// --- dosage ---
const dosageParse: [string, number | undefined][] = [
  ['2', 2],
  ['0.5', 0.5],
  ['0,5', 0.5],
  ['0', undefined],
  ['-2', undefined],
  ['abc', undefined],
  ['', undefined],
];
const dosageParseOk = dosageParse.every(([raw, expected]) => parseDosageQuantity(raw) === expected);
record('form.parse-dosage', 'parseDosageQuantity accepts positive numbers, rejects zero/garbage', dosageParseOk, dosageParse.map(([raw]) => `${JSON.stringify(raw)}→${parseDosageQuantity(raw)}`).join('; '));

const dosageSplit: [string, { dosageQuantity: string; dosageUnit: string }][] = [
  ['2 tablets', { dosageQuantity: '2', dosageUnit: 'tablets' }],
  ['2 other', { dosageQuantity: '2', dosageUnit: 'other' }],
  ['0.5 tsp', { dosageQuantity: '0.5', dosageUnit: 'tsp' }],
  ['2', { dosageQuantity: '2', dosageUnit: '' }],
  ['x', { dosageQuantity: 'x', dosageUnit: '' }],
];
const dosageSplitOk = dosageSplit.every(([raw, expected]) => eq(splitDosage(raw), expected));
record('form.split-dosage', 'splitDosage round-trips every dosage unit, including "other"', dosageSplitOk, dosageSplit.map(([raw]) => `${JSON.stringify(raw)}→${JSON.stringify(splitDosage(raw))}`).join('; '));

// The mutation writes "qty unit"; splitDosage must read that back.
const dosageStored: [number, string][] = [
  [2, 'tablets'],
  [2, 'other'],
  [0.5, 'tsp'],
];
const dosageStoredOk = dosageStored.every(([qty, unit]) => {
  const back = splitDosage(`${qty} ${unit}`);
  return back.dosageUnit === unit && parseDosageQuantity(back.dosageQuantity) === qty;
});
record('form.dosage-round-trip', 'stored "qty unit" strings parse back to the same quantity and unit', dosageStoredOk, dosageStored.map(([qty, unit]) => `${qty} ${unit}`).join('; '));

// --- validation ---
record('form.validate-ok', 'a filled default form validates without errors', eq(validateMedicationForm(values({}), t), {}), JSON.stringify(validateMedicationForm(values({}), t)));

const startAfterEnd = validateMedicationForm(values({ startDate: '2026-02-01', endDate: '2026-01-01' }), t);
record('form.validate-start-after-end', 'start date after course end is rejected', startAfterEnd.startDate === 'startDateAfterEndDateError', `errors=${JSON.stringify(startAfterEnd)}`);

const badStart = validateMedicationForm(values({ startDate: '2026-02-30' }), t);
record('form.validate-start-format', 'impossible start dates (Feb 30) are rejected', badStart.startDate === 'startDateError', `errors=${JSON.stringify(badStart)}`);

const zeroDosage = validateMedicationForm(values({ dosageQuantity: '0' }), t);
record('form.validate-dosage-zero', 'dosage quantity of 0 is rejected', zeroDosage.dosageQuantity === 'dosageQuantityError', `errors=${JSON.stringify(zeroDosage)}`);

const okDosage = validateMedicationForm(values({ dosageQuantity: '2' }), t);
record('form.validate-dosage-ok', 'a positive dosage quantity validates', okDosage.dosageQuantity === undefined, `errors=${JSON.stringify(okDosage)}`);

// --- schedule field mapping ---
const emptyFields = scheduleFieldsFromForm(values({}));
record('form.schedule-empty', 'empty date/dosage fields map to undefined, not empty strings', emptyFields.startDate === undefined && emptyFields.dosageQuantity === undefined && emptyFields.dosageUnit === undefined, JSON.stringify(emptyFields));

const mapped = scheduleFieldsFromForm(values({ cadence: 'interval', intervalStart: '', startDate: '2026-03-01', dosageQuantity: '2', dosageUnit: 'tablets' }));
record('form.schedule-mapping', 'interval plans fall back to the regimen start date as their anchor', mapped.intervalStart === '2026-03-01' && mapped.startDate === '2026-03-01' && mapped.dosageQuantity === 2 && mapped.dosageUnit === 'tablets', JSON.stringify(mapped));

// --- date parsing ---
record('form.parse-dateonly', 'parseDateOnly rejects impossible calendar dates', parseDateOnly('2026-02-30') === null && parseDateOnly('2026-13-01') === null && parseDateOnly('2026-02-28') !== null, `'2026-02-30'→${String(parseDateOnly('2026-02-30'))}, '2026-02-28'→${String(parseDateOnly('2026-02-28'))}`);

// --- units and locales ---
const strengthNoOther = !STRENGTH_UNIT_OPTIONS.includes('other') && DOSAGE_UNIT_OPTIONS.includes('other');
record('form.unit-options', 'strength units drop the free-form "other"; dosage units keep it', strengthNoOther, `strength=[${STRENGTH_UNIT_OPTIONS.join(',')}] dosage has other=${DOSAGE_UNIT_OPTIONS.includes('other')}`);

const missingEn = Object.values(MEDICATION_UNIT_LABELS).filter((key) => typeof (en as Record<string, string>)[key] !== 'string');
const missingDe = Object.values(MEDICATION_UNIT_LABELS).filter((key) => typeof (de as Record<string, string>)[key] !== 'string');
record('form.unit-labels', 'every unit label key exists in both locales', missingEn.length === 0 && missingDe.length === 0, `missing en=[${missingEn.join(',')}] de=[${missingDe.join(',')}]`);

for (const check of checks) {
  const mark = check.passed ? 'PASS' : 'FAIL';
  // eslint-disable-next-line no-console
  console.log(`${mark}  ${check.id}  ${check.title}`);
  // eslint-disable-next-line no-console
  console.log(`      ${check.details}`);
}

if (!checks.every((check) => check.passed)) {
  process.exitCode = 1;
}
