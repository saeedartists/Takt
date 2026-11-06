import { TAKT_EXT } from './constants';
import type { FhirExtension, MedicationAppearance, MedicationShape, PausePeriod } from './types';

/*
 * S-08: pause history and pill appearance as complex FHIR extensions instead of
 * JSON strings, so the server can validate/search them and a bad value can't
 * silently reset to "no pauses". Readers take the structured shape first and
 * fall back to the legacy string; writers emit both for one release so older
 * app builds keep working (then drop the legacy write + run the backfill
 * with --drop-legacy).
 */

const SHAPES = new Set<MedicationShape>([
  'round',
  'oval',
  'capsule',
  'drops',
  'inhaler',
  'injection',
  'other',
]);
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
    return parsed
      .filter((item): item is { start: string; end?: string } => {
        const x = item as { start?: unknown; end?: unknown } | null;
        return (
          Boolean(x) && isValidInstant(x?.start) && (x?.end === undefined || isValidInstant(x.end))
        );
      })
      .map((item) => ({ start: item.start, ...(item.end ? { end: item.end } : {}) }));
  } catch {
    return [];
  }
};

export const readPauseHistory = (extensions: FhirExtension[] | undefined): PausePeriod[] => {
  const hasStructured = (extensions ?? []).some((x) => x.url === TAKT_EXT.pausePeriod);
  if (!hasStructured) {
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

/** Replace any pause data with one `pause-period` per period, plus the legacy string (one release). */
export const withPauseHistory = (
  extensions: FhirExtension[] | undefined,
  periods: PausePeriod[],
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
  { url: TAKT_EXT.pauseHistory, valueString: JSON.stringify(periods) },
];

const validAppearance = (shape: unknown, color: unknown): MedicationAppearance | undefined =>
  typeof shape === 'string' &&
  SHAPES.has(shape as MedicationShape) &&
  typeof color === 'string' &&
  COLOR.test(color)
    ? { shape: shape as MedicationShape, color }
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

/** Structured appearance plus the legacy JSON string (one release). */
export const appearanceExtensions = (
  appearance: MedicationAppearance | undefined,
): FhirExtension[] =>
  appearance
    ? [
        {
          url: TAKT_EXT.medicationAppearance,
          extension: [
            { url: 'shape', valueCode: appearance.shape },
            { url: 'color', valueString: appearance.color },
          ],
        },
        { url: TAKT_EXT.appearance, valueString: JSON.stringify(appearance) },
      ]
    : [];
