import { TAKT_EXT } from './constants.js';
import type { FhirExtension, PausePeriod } from './types.js';

/*
 * S-08 server mirror of src/lib/takt/structured-extensions.ts (the app and the
 * server build separately). Reads the structured `pause-period` /
 * `medication-appearance` extensions first, the legacy JSON strings second.
 */

export type MedicationAppearance = { shape: string; color: string };

const SHAPES = new Set(['round', 'oval', 'capsule', 'drops', 'inhaler', 'injection', 'other']);
const COLOR = /^#[0-9a-fA-F]{6}$/;

const sub = (ext: FhirExtension | undefined, url: string): FhirExtension | undefined =>
  ext?.extension?.find((x) => x.url === url);

const isValidInstant = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

const byStart = (a: PausePeriod, b: PausePeriod) => Date.parse(a.start) - Date.parse(b.start);

const parseLegacyPauses = (raw: string | undefined): PausePeriod[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): PausePeriod[] => {
      const x = item as { start?: unknown; end?: unknown } | null;
      if (!x || !isValidInstant(x.start) || (x.end !== undefined && !isValidInstant(x.end)))
        return [];
      return [x.end ? { start: x.start, end: x.end as string } : { start: x.start }];
    });
  } catch {
    return [];
  }
};

export const hasStructuredPauses = (extensions: FhirExtension[] | undefined): boolean =>
  (extensions ?? []).some((x) => x.url === TAKT_EXT.pausePeriod);

export const readPauseHistory = (extensions: FhirExtension[] | undefined): PausePeriod[] => {
  if (!hasStructuredPauses(extensions)) {
    return parseLegacyPauses(
      extensions?.find((x) => x.url === TAKT_EXT.pauseHistory)?.valueString,
    ).sort(byStart);
  }
  return (extensions ?? [])
    .filter((x) => x.url === TAKT_EXT.pausePeriod)
    .flatMap((x): PausePeriod[] => {
      const start = sub(x, 'start')?.valueDateTime;
      const end = sub(x, 'end')?.valueDateTime;
      if (!isValidInstant(start) || (end !== undefined && !isValidInstant(end))) return [];
      return [end ? { start, end } : { start }];
    })
    .sort(byStart);
};

/** Structured periods, plus the legacy string unless `dropLegacy` (after old app builds are retired). */
export const withPauseHistory = (
  extensions: FhirExtension[] | undefined,
  periods: PausePeriod[],
  dropLegacy = false,
): FhirExtension[] => [
  ...(extensions ?? []).filter(
    (x) => x.url !== TAKT_EXT.pausePeriod && x.url !== TAKT_EXT.pauseHistory,
  ),
  ...[...periods].sort(byStart).map((p) => ({
    url: TAKT_EXT.pausePeriod,
    extension: [
      { url: 'start', valueDateTime: p.start },
      ...(p.end ? [{ url: 'end', valueDateTime: p.end }] : []),
    ],
  })),
  ...(dropLegacy ? [] : [{ url: TAKT_EXT.pauseHistory, valueString: JSON.stringify(periods) }]),
];

const validAppearance = (shape: unknown, color: unknown): MedicationAppearance | undefined =>
  typeof shape === 'string' && SHAPES.has(shape) && typeof color === 'string' && COLOR.test(color)
    ? { shape, color }
    : undefined;

export const readAppearance = (
  extensions: FhirExtension[] | undefined,
): MedicationAppearance | undefined => {
  const structured = extensions?.find((x) => x.url === TAKT_EXT.medicationAppearance);
  if (structured)
    return validAppearance(
      sub(structured, 'shape')?.valueCode,
      sub(structured, 'color')?.valueString,
    );
  const raw = extensions?.find((x) => x.url === TAKT_EXT.appearance)?.valueString;
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { shape?: unknown; color?: unknown };
    return validAppearance(parsed.shape, parsed.color);
  } catch {
    return undefined;
  }
};

export const withAppearance = (
  extensions: FhirExtension[] | undefined,
  appearance: MedicationAppearance,
  dropLegacy = false,
): FhirExtension[] => [
  ...(extensions ?? []).filter(
    (x) => x.url !== TAKT_EXT.medicationAppearance && x.url !== TAKT_EXT.appearance,
  ),
  {
    url: TAKT_EXT.medicationAppearance,
    extension: [
      { url: 'shape', valueCode: appearance.shape },
      { url: 'color', valueString: appearance.color },
    ],
  },
  ...(dropLegacy ? [] : [{ url: TAKT_EXT.appearance, valueString: JSON.stringify(appearance) }]),
];
