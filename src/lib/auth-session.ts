import { env, hasLiveBackendConfig } from './env';
import { ovokFetch, OvokFetchError } from './ovok-fetch';

export type SessionGateResult =
  | { kind: 'mock' }
  | { kind: 'needs-config' }
  | { kind: 'unauthenticated' }
  | { kind: 'authenticated' };

export const resolveSessionGate = async (): Promise<SessionGateResult> => {
  if (env.ovokMockEnabled) return { kind: 'mock' };
  if (!hasLiveBackendConfig()) return { kind: 'needs-config' };

  try {
    await ovokFetch('/auth/me');
    return { kind: 'authenticated' };
  } catch (error) {
    if (error instanceof OvokFetchError && (error.status === 401 || error.status === 403)) {
      return { kind: 'unauthenticated' };
    }
    return { kind: 'unauthenticated' };
  }
};
