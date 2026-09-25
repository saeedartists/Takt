import { requireOptionalNativeModule } from 'expo';

export type AlarmAuthorization = 'authorized' | 'denied' | 'notDetermined' | 'unavailable';

type TaktAlarmNative = {
  isAvailable(): boolean;
  getAuthorizationStatus(): Promise<AlarmAuthorization>;
  requestAuthorization(): Promise<AlarmAuthorization>;
  schedule(options: {
    epochSeconds: number;
    title: string;
    stopLabel: string;
    openLabel: string;
    soundName?: string;
    tintHex?: string;
  }): Promise<string | null>;
  cancelAll(): Promise<number>;
};

// Null on web, Android, Expo Go and any build without the native module: callers fall back to notifications.
const native = requireOptionalNativeModule<TaktAlarmNative>('TaktAlarm');

/** True when this device can ring real alarms (iOS 26+ with AlarmKit). */
export const alarmsAvailable = (): boolean => Boolean(native?.isAvailable());

export const getAlarmAuthorization = async (): Promise<AlarmAuthorization> =>
  native ? native.getAuthorizationStatus() : 'unavailable';

export const requestAlarmAuthorization = async (): Promise<AlarmAuthorization> =>
  native ? native.requestAuthorization() : 'unavailable';

export const scheduleAlarm = async (options: Parameters<TaktAlarmNative['schedule']>[0]): Promise<string | null> =>
  native ? native.schedule(options) : null;

export const cancelAllAlarms = async (): Promise<number> => (native ? native.cancelAll() : 0);
