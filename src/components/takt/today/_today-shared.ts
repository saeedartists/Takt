import type { DoseOccurrence } from '@/lib/takt/types';
import type { useTokens } from '@/theme/use-tokens';

/* Pure helpers and shared shapes for the today screen. */

export const SNOOZE_OPTIONS = [5, 10, 15, 30];

/** True once the dose's event reached the backend (no optimistic-id prefix). */
export const isPersisted = (dose: DoseOccurrence): boolean =>
  Boolean(dose.eventId) && !dose.eventId!.startsWith('optimistic-');

/** Undo stays possible for 10 minutes after a logged dose. */
export const canUndo = (dose: DoseOccurrence): boolean => {
  if (!dose.eventTimestamp || !isPersisted(dose)) return false;
  if (!['taken', 'skipped'].includes(dose.state)) return false;
  const ageMs = Date.now() - new Date(dose.eventTimestamp).getTime();
  return ageMs <= 10 * 60 * 1000;
};

export const isActionable = (dose: DoseOccurrence): boolean => dose.state === 'due' || dose.state === 'missed';

export const getTimeIcon = (hour: number, c: ReturnType<typeof useTokens>['c']) => {
  if (hour < 12) return { name: 'sunny-outline' as const, color: c.accent };
  if (hour < 18) return { name: 'partly-sunny-outline' as const, color: c.accent };
  return { name: 'moon-outline' as const, color: c.tones.lilac.solid };
};
