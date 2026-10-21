import 'dotenv/config';
import { runFamilyShareUnconfirmedScan } from '../src/bots/family-share-scan.js';
import { loadConfig } from '../src/config.js';
import { sendExpoPush } from '../src/expo-push.js';
import { createOvokFhirClient } from '../src/ovok.js';
import { printResult } from './output.js';

const main = async (): Promise<void> => {
  const config = loadConfig();
  const fhir = createOvokFhirClient(config);
  const dryRun = process.argv.includes('--dry-run');
  const includePhi = process.argv.includes('--include-phi');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const offsetArg = process.argv.find((arg) => arg.startsWith('--offset='));
  const maxPatients = limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '', 10) : undefined;
  const offset = offsetArg ? Number.parseInt(offsetArg.split('=')[1] ?? '', 10) : undefined;

  const result = await runFamilyShareUnconfirmedScan(
    {
      fhir,
      sendPush: (messages) => sendExpoPush(messages, { accessToken: config.EXPO_ACCESS_TOKEN }),
    },
    {
      dryRun,
      concurrency: config.TAKT_BOT_CONCURRENCY,
      defaultTimezone: config.TAKT_DEFAULT_TIMEZONE,
      unconfirmedHours: config.TAKT_UNCONFIRMED_HOURS,
      maxAgeHours: config.TAKT_MAX_AGE_HOURS,
      channelId: config.TAKT_PUSH_CHANNEL_ID,
      quietHours: {
        startHour: config.TAKT_QUIET_HOURS_START,
        endHour: config.TAKT_QUIET_HOURS_END,
      },
      ...(Number.isFinite(maxPatients) ? { maxPatients } : {}),
      ...(Number.isFinite(offset) ? { offset } : {}),
    },
  );

  printResult({ ...result, dryRun }, includePhi);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
