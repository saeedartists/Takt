import { describe, expect, it } from 'vitest';

import { readSupplyAnchor, remainingSupply, unitsPerDose, withSupplyAnchor } from './supply-anchor';

const REQ = 'MedicationRequest/r1';
const anchor = { count: 30, at: '2026-11-01T10:00:00.000Z' };
const dose = (effectiveDateTime: string, status = 'completed', request = REQ) => ({
  status,
  request: { reference: request },
  effectiveDateTime,
});

describe('remainingSupply (S-04)', () => {
  it('subtracts completed doses after the anchor, per-intake amount each', () => {
    const log = [dose('2026-11-02T08:00:00Z'), dose('2026-11-02T20:00:00Z')];
    expect(remainingSupply(anchor, log, REQ, 2)).toBe(26);
  });

  it('ignores skipped doses, other plans, and doses from before the anchor', () => {
    const log = [
      dose('2026-11-02T08:00:00Z', 'not-done'),
      dose('2026-11-02T08:00:00Z', 'completed', 'MedicationRequest/other'),
      dose('2026-10-31T08:00:00Z'),
      dose('2026-11-03T08:00:00Z'),
    ];
    expect(remainingSupply(anchor, log, REQ)).toBe(29);
  });

  it('never goes below zero', () => {
    const log = Array.from({ length: 40 }, (_, i) =>
      dose(`2026-11-0${(i % 8) + 2}T0${i % 10}:00:00Z`),
    );
    expect(remainingSupply(anchor, log, REQ)).toBe(0);
  });

  it('a deleted (undone) dose simply is not in the log, so the count comes back', () => {
    expect(remainingSupply(anchor, [], REQ)).toBe(30);
  });

  it('unitsPerDose mirrors deductSupply: at least 1, rounded', () => {
    expect(unitsPerDose(undefined)).toBe(1);
    expect(unitsPerDose(0.5)).toBe(1);
    expect(unitsPerDose(2)).toBe(2);
  });
});

describe('anchor extension round-trip', () => {
  it('writes, replaces and reads the anchor', () => {
    const first = withSupplyAnchor([{ url: 'x', valueString: 'keep' }], 30, anchor.at);
    const second = withSupplyAnchor(first, 12, '2026-11-05T00:00:00.000Z');
    expect(second).toHaveLength(2);
    expect(readSupplyAnchor({ extension: second })).toEqual({
      count: 12,
      at: '2026-11-05T00:00:00.000Z',
    });
  });

  it('drops the anchor when the count is cleared, and rejects malformed ones', () => {
    expect(
      readSupplyAnchor({ extension: withSupplyAnchor([], undefined, anchor.at) }),
    ).toBeUndefined();
    expect(
      readSupplyAnchor({
        extension: [{ url: 'https://actimi.com/fhir/takt/supply-anchor', extension: [] }],
      }),
    ).toBeUndefined();
  });
});
