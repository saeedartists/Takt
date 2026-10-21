import 'dotenv/config';
import { runFamilyShareUnconfirmed } from '../src/bots/family-share-unconfirmed.js';
import { loadConfig } from '../src/config.js';
import { sendExpoPush } from '../src/expo-push.js';
import { createOvokFhirClient } from '../src/ovok.js';
import { printResult } from './output.js';

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const includePhi = args.includes('--include-phi');
  const [patientRef] = args.filter((arg) => !arg.startsWith('--'));
  if (!patientRef) {
    throw new Error('Usage: npm run bot:unconfirmed -- <patient-ref> [--dry-run]');
  }

  const config = loadConfig();
  const fhir = createOvokFhirClient(config);
  const dryRun = process.argv.includes('--dry-run');
  const result = await runFamilyShareUnconfirmed(
    { patientRef },
    {
      fhir,
      sendPush: (messages) => sendExpoPush(messages, { accessToken: config.EXPO_ACCESS_TOKEN }),
    },
    {
      dryRun,
      defaultTimezone: config.TAKT_DEFAULT_TIMEZONE,
      unconfirmedHours: config.TAKT_UNCONFIRMED_HOURS,
      maxAgeHours: config.TAKT_MAX_AGE_HOURS,
      channelId: config.TAKT_PUSH_CHANNEL_ID,
      quietHours: {
        startHour: config.TAKT_QUIET_HOURS_START,
        endHour: config.TAKT_QUIET_HOURS_END,
      },
    },
  );

  printResult({ ...result, dryRun }, includePhi);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
