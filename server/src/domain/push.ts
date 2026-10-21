import { FAMILY_SHARE_PUSH_CHANNEL_ID } from './constants.js';
import type { ExpoPushMessage } from './types.js';

export const isExpoPushToken = (value: string): boolean => /^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(value);

export const buildFamilySharePushMessage = (
  token: string,
  patientRef: string,
  channelId = FAMILY_SHARE_PUSH_CHANNEL_ID,
): ExpoPushMessage => ({
  to: token,
  title: 'Takt',
  body: 'A shared dose is still unconfirmed.',
  sound: null,
  priority: 'normal',
  channelId,
  interruptionLevel: 'passive',
  ttl: 3600,
  data: {
    type: 'family-share-unconfirmed',
    patientRef,
  },
});

export const chunk = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};
