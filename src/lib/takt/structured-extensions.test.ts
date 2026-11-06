import { describe, expect, it } from 'vitest';

import { TAKT_EXT } from './constants';
import {
  appearanceExtensions,
  readAppearance,
  readPauseHistory,
  withPauseHistory,
} from './structured-extensions';

const legacyPauses = (periods: unknown) => [
  { url: TAKT_EXT.pauseHistory, valueString: JSON.stringify(periods) },
];
const p1 = { start: '2026-11-01T08:00:00.000Z', end: '2026-11-03T08:00:00.000Z' };
const p2 = { start: '2026-11-05T08:00:00.000Z' };

describe('pause history (S-08)', () => {
  it('reads legacy JSON when no structured periods exist', () => {
    expect(readPauseHistory(legacyPauses([p2, p1]))).toEqual([p1, p2]);
  });

  it('writes structured + legacy, and both readers agree', () => {
    const written = withPauseHistory([{ url: 'other', valueString: 'keep' }], [p2, p1]);
    expect(written.filter((x) => x.url === TAKT_EXT.pausePeriod)).toHaveLength(2);
    expect(written.find((x) => x.url === 'other')).toBeDefined();
    expect(readPauseHistory(written)).toEqual([p1, p2]);
    // what an older app build reads:
    expect(
      JSON.parse(written.find((x) => x.url === TAKT_EXT.pauseHistory)?.valueString ?? ''),
    ).toHaveLength(2);
  });

  it('structured wins over a stale legacy string', () => {
    const written = [
      ...withPauseHistory([], [p1]).filter((x) => x.url === TAKT_EXT.pausePeriod),
      ...legacyPauses([p1, p2]),
    ];
    expect(readPauseHistory(written)).toEqual([p1]);
  });

  it('rewriting replaces, never duplicates', () => {
    const once = withPauseHistory([], [p1]);
    const twice = withPauseHistory(once, [p1, p2]);
    expect(twice.filter((x) => x.url === TAKT_EXT.pausePeriod)).toHaveLength(2);
    expect(twice.filter((x) => x.url === TAKT_EXT.pauseHistory)).toHaveLength(1);
  });

  it('drops malformed periods instead of failing', () => {
    expect(readPauseHistory(legacyPauses([{ start: 'not-a-date' }, p2]))).toEqual([p2]);
    expect(readPauseHistory([{ url: TAKT_EXT.pauseHistory, valueString: '{broken' }])).toEqual([]);
    expect(
      readPauseHistory([
        { url: TAKT_EXT.pausePeriod, extension: [{ url: 'end', valueDateTime: p1.end }] },
      ]),
    ).toEqual([]);
  });
});

describe('appearance (S-08)', () => {
  const pill = { shape: 'oval' as const, color: '#AA3355' };

  it('round-trips structured + legacy', () => {
    const written = appearanceExtensions(pill);
    expect(readAppearance(written)).toEqual(pill);
    expect(readAppearance(written.filter((x) => x.url === TAKT_EXT.appearance))).toEqual(pill);
    expect(appearanceExtensions(undefined)).toEqual([]);
  });

  it('rejects unknown shapes and bad colours', () => {
    expect(
      readAppearance([
        { url: TAKT_EXT.appearance, valueString: '{"shape":"star","color":"#000000"}' },
      ]),
    ).toBeUndefined();
    expect(
      readAppearance([
        {
          url: TAKT_EXT.medicationAppearance,
          extension: [
            { url: 'shape', valueCode: 'round' },
            { url: 'color', valueString: 'red' },
          ],
        },
      ]),
    ).toBeUndefined();
  });
});
