import { z } from 'zod';

const timezoneSchema = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Expected an IANA timezone.');

const configSchema = z.object({
  OVOK_API_URL: z.string().url().default('https://api.ovok.com'),
  OVOK_TENANT_CODE: z.string().min(1),
  OVOK_CLIENT_ID: z.string().min(1).optional(),
  OVOK_CLIENT_SECRET: z.string().min(1).optional(),
  OVOK_TOKEN_URL: z.string().url().optional(),
  OVOK_SCOPE: z.string().min(1).optional(),
  OVOK_ACCESS_TOKEN: z.string().min(1).optional(),
  OVOK_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15_000),
  OVOK_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  EXPO_ACCESS_TOKEN: z.string().min(1).optional(),
  TAKT_PUSH_CHANNEL_ID: z.string().min(1).default('family-share'),
  TAKT_DEFAULT_TIMEZONE: timezoneSchema.default('UTC'),
  TAKT_QUIET_HOURS_START: z.coerce.number().int().min(0).max(23).default(21),
  TAKT_QUIET_HOURS_END: z.coerce.number().int().min(0).max(23).default(8),
  TAKT_UNCONFIRMED_HOURS: z.coerce.number().min(0.5).max(48).default(2),
  TAKT_MAX_AGE_HOURS: z.coerce.number().min(1).max(72).default(26),
  TAKT_BOT_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(4),
  TAKT_FAMILY_SHARE_BOT_ID: z.string().optional(),
  TAKT_UNCONFIRMED_BOT_ID: z.string().optional(),
  TAKT_ERASE_BOT_ID: z.string().optional(),
}).superRefine((value, context) => {
  if (value.TAKT_MAX_AGE_HOURS < value.TAKT_UNCONFIRMED_HOURS) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['TAKT_MAX_AGE_HOURS'],
      message: 'TAKT_MAX_AGE_HOURS must be at least TAKT_UNCONFIRMED_HOURS.',
    });
  }
});

export type ServerConfig = z.infer<typeof configSchema>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => configSchema.parse(env);
