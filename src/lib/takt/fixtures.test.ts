import { describe, expect, it } from 'vitest';

import { runAdherenceFixtureSuite } from './fixtures/adherence-fixtures';
import { runReportParityFixtureSuite } from './fixtures/report-parity-fixtures';

/*
 * The fixture suites are the app's own behavioral specification for the
 * dose-state machine; running them under vitest keeps them in every
 * standard test run, not only behind the verify:* npm scripts.
 */

describe('adherence fixtures', () => {
  const suite = runAdherenceFixtureSuite();

  it('passes every fixture', () => {
    const failures = suite.results.filter((result) => !result.passed);
    expect(failures.map((failure) => `${failure.id}: ${failure.details}`)).toEqual([]);
    expect(suite.passed).toBe(true);
  });

  it('covers the documented matrix (11 fixtures)', () => {
    expect(suite.results).toHaveLength(11);
  });
});

describe('report parity fixtures', () => {
  const suite = runReportParityFixtureSuite();

  it('passes every fixture', () => {
    const failures = suite.results.filter((result) => !result.passed);
    expect(failures.map((failure) => `${failure.id}: ${failure.details}`)).toEqual([]);
    expect(suite.passed).toBe(true);
  });
});
