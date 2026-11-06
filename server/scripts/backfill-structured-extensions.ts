import 'dotenv/config';
import { runStructuredExtensionBackfill } from '../src/bots/backfill-structured-extensions.js';
import { loadConfig } from '../src/config.js';
import { createOvokFhirClient } from '../src/ovok.js';
import { printResult } from './output.js';

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--confirm');
  const includePhi = args.includes('--include-phi');
  const config = loadConfig();
  const fhir = createOvokFhirClient(config);
  // S-08: phase 1 adds structured extensions; --drop-legacy (phase 2) removes the JSON strings.
  const dropLegacy = args.includes('--drop-legacy');
  const summary = await runStructuredExtensionBackfill(fhir, { dryRun, dropLegacy });
  printResult({ ...summary, dryRun, dropLegacy }, includePhi);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
