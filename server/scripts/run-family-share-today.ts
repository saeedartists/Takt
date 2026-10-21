import 'dotenv/config';
import { runFamilyShareToday } from '../src/bots/family-share-today.js';
import { loadConfig } from '../src/config.js';
import { createOvokFhirClient } from '../src/ovok.js';
import { printResult } from './output.js';

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const includePhi = args.includes('--include-phi');
  const [relativePatientRef, relativeEmail, patientRef] = args.filter(
    (arg) => !arg.startsWith('--'),
  );
  if (!relativePatientRef || !relativeEmail) {
    throw new Error(
      'Usage: npm run bot:family-share-today -- <relative-patient-ref> <relative-email> [patient-ref] [--include-phi]',
    );
  }

  const config = loadConfig();
  const fhir = createOvokFhirClient(config);
  const result = await runFamilyShareToday(
    {
      relativePatientRef,
      relativeEmail,
      ...(patientRef ? { patientRef } : {}),
    },
    { fhir, defaultTimezone: config.TAKT_DEFAULT_TIMEZONE },
  );

  printResult(result, includePhi);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
