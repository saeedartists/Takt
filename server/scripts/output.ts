const PHI_KEYS = new Set([
  'patientLabel',
  'relativeEmail',
  'label',
  'strength',
  'form',
  'display',
  'name',
  'contentString',
]);

const redactValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      PHI_KEYS.has(key) ? '[redacted]' : redactValue(nested),
    ]),
  );
};

export const printResult = (value: unknown, includePhi: boolean): void => {
  console.log(JSON.stringify(includePhi ? value : redactValue(value), null, 2));
};
