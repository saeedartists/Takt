import 'dotenv/config';
import { runErasure } from '../src/bots/erasure.js';
import { loadConfig } from '../src/config.js';
import { createOvokFhirClient } from '../src/ovok.js';

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const patientRef = args.find((arg) => !arg.startsWith('--'));
  const confirmed = args.includes('--confirm');
  const dryRun = args.includes('--dry-run') || !confirmed;

  if (!patientRef) {
    throw new Error('Usage: npm run bot:erase -- <patient-ref> [--dry-run] --confirm');
  }
  if (!confirmed && !args.includes('--dry-run')) {
    throw new Error('Refusing to erase without --confirm. Run with --dry-run first.');
  }

  const config = loadConfig();
  const fhir = createOvokFhirClient(config);
  const summary = await runErasure({ patientRef, dryRun }, { fhir });

  console.log(JSON.stringify({ ...summary, dryRun }, null, 2));
};

main().catch((error: unknown) => {
  const summary = (error as { summary?: unknown } | undefined)?.summary;
  if (summary) console.log(JSON.stringify(summary, null, 2));
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
