import { env, hasLiveBackendConfig } from './env';
import { ovokFetch, OvokFetchError } from './ovok-fetch';

export type SessionGateResult =
  | { kind: 'mock' }
  | { kind: 'needs-config' }
  | { kind: 'unauthenticated' }
  | { kind: 'backend-unreachable'; detail?: string }
  | { kind: 'authenticated' };

export const resolveSessionGate = async (): Promise<SessionGateResult> => {
  if (env.ovokMockEnabled) return { kind: 'mock' };
  if (!hasLiveBackendConfig()) return { kind: 'needs-config' };

  try {
    await ovokFetch('/auth/me');
    return { kind: 'authenticated' };
  } catch (error) {
    if (error instanceof OvokFetchError) {
      if (error.status === 401 || error.status === 403) {
        return { kind: 'unauthenticated' };
      }

      if (error.status >= 500 || error.status === 404) {
        return { kind: 'backend-unreachable', detail: String(error.status) };
      }
    }

    return { kind: 'backend-unreachable' };
  }
};
