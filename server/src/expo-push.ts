import { chunk } from './domain/push.js';
import type { ExpoPushMessage, ExpoPushResult } from './domain/types.js';

type ExpoPushTicket = {
  status?: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
  };
};

type ExpoPushResponse = {
  data?: ExpoPushTicket[];
};

export type ExpoPushOptions = {
  accessToken?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
};

const invalidTokenErrors = new Set(['DeviceNotRegistered', 'MismatchSenderId']);

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const backoff = (attempt: number): number =>
  Math.min(500 * 2 ** attempt, 5000) + Math.floor(Math.random() * 250);

const retryDelay = (response: Response, attempt: number): number => {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number.parseInt(header, 10);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000);
  }
  return backoff(attempt);
};

export const sendExpoPush = async (
  messages: ExpoPushMessage[],
  options: ExpoPushOptions = {},
): Promise<ExpoPushResult[]> => {
  if (messages.length === 0) return [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? 'https://exp.host/--/api/v2/push/send';
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxRetries = options.maxRetries ?? 1;
  const results: ExpoPushResult[] = [];

  for (const batch of chunk(messages, 100)) {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };
    if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

    let response: Response | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(batch),
          signal: controller.signal,
        });
      } catch (error) {
        if (attempt < maxRetries) {
          await sleep(backoff(attempt));
          continue;
        }
        const message = controller.signal.aborted ? 'expo-timeout' : 'expo-network-error';
        for (let index = 0; index < batch.length; index += 1) {
          results.push({ ok: false, error: message });
        }
        response = undefined;
        break;
      } finally {
        clearTimeout(timeout);
      }

      if (response.ok) break;
      if (attempt < maxRetries && (response.status === 429 || response.status >= 500)) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      break;
    }

    if (!response) continue;

    if (!response.ok) {
      for (let index = 0; index < batch.length; index += 1) {
        results.push({ ok: false, error: `expo-http-${response.status.toString()}` });
      }
      continue;
    }

    let payload: ExpoPushResponse;
    try {
      payload = (await response.json()) as ExpoPushResponse;
    } catch {
      for (let index = 0; index < batch.length; index += 1) {
        results.push({ ok: false, error: 'expo-invalid-response' });
      }
      continue;
    }

    const tickets = Array.isArray(payload.data) ? payload.data : [];
    for (let index = 0; index < batch.length; index += 1) {
      const ticket = tickets[index];
      if (!ticket) {
        results.push({ ok: false, error: 'missing-ticket' });
        continue;
      }
      if (ticket.status === 'ok') {
        results.push({ ok: true });
        continue;
      }
      const error = ticket.details?.error ?? ticket.message ?? 'push-error';
      results.push({
        ok: false,
        error,
        invalidToken: invalidTokenErrors.has(ticket.details?.error ?? ''),
      });
    }
  }

  return results;
};
