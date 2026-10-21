import 'dotenv/config';
import { runMedicationScopeBackfill } from '../src/bots/backfill-medication-scope.js';
import { loadConfig } from '../src/config.js';
import { createOvokFhirClient } from '../src/ovok.js';
import { printResult } from './output.js';

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--confirm');
  const includePhi = args.includes('--include-phi');
  const config = loadConfig();
  const fhir = createOvokFhirClient(config);
  const summary = await runMedicationScopeBackfill(fhir, { dryRun });
  printResult({ ...summary, dryRun }, includePhi);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
