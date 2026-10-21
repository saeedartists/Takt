import { defineConfig } from 'vitest/config';

/*
 * Client unit tests cover the pure lib layer (src/lib/takt) — schedule
 * math, time helpers, exports, form/validation logic. React components
 * and hooks stay covered by the verify:* fixture suites and manual QA;
 * they need a RN environment to run meaningfully.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/takt/**/*.test.ts'],
  },
});
