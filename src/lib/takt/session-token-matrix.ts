import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const SESSION_QA_CASES = [
  { id: 'st-01-sign-in-success', priority: 'p0' },
  { id: 'st-02-sign-in-failure', priority: 'p0' },
  { id: 'st-03-registration-success', priority: 'p0' },
  { id: 'st-04-registration-duplicate-email', priority: 'p1' },
  { id: 'st-05-sign-out', priority: 'p0' },
  { id: 'st-06-app-restart-valid-session', priority: 'p0' },
  { id: 'st-07-app-restart-after-sign-out', priority: 'p0' },
  { id: 'st-08-invalid-token-handling', priority: 'p0' },
  { id: 'st-09-protected-route-guard', priority: 'p0' },
  { id: 'st-10-cross-account-switch', priority: 'p0' },
  { id: 'st-11-consent-flow-continuity', priority: 'p1' },
  { id: 'st-12-auth-endpoint-unavailable', priority: 'p1' },
  { id: 'mp-01-malformed-fhir-payload', priority: 'p0' },
  { id: 'mp-02-error-surfacing-quality', priority: 'p1' },
] as const;

export type SessionQaCaseId = (typeof SESSION_QA_CASES)[number]['id'];

export type SessionTokenMatrixState = {
  testerName: string;
  runDate: string;
  deviceSummary: string;
  appVersion: string;
  notes: string;
  cases: Record<SessionQaCaseId, boolean>;
};

const STORAGE_KEY = 'takt:session-token-matrix:v1';

const emptyState = (): SessionTokenMatrixState => ({
  testerName: '',
  runDate: '',
  deviceSummary: '',
  appVersion: '',
  notes: '',
  cases: Object.fromEntries(SESSION_QA_CASES.map((item) => [item.id, false])) as Record<SessionQaCaseId, boolean>,
});

const sanitize = (raw: unknown): SessionTokenMatrixState => {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;

  const value = raw as Record<string, unknown>;
  base.testerName = typeof value.testerName === 'string' ? value.testerName : '';
  base.runDate = typeof value.runDate === 'string' ? value.runDate : '';
  base.deviceSummary = typeof value.deviceSummary === 'string' ? value.deviceSummary : '';
  base.appVersion = typeof value.appVersion === 'string' ? value.appVersion : '';
  base.notes = typeof value.notes === 'string' ? value.notes : '';

  if (value.cases && typeof value.cases === 'object') {
    const caseMap = value.cases as Record<string, unknown>;
    for (const item of SESSION_QA_CASES) {
      const rawCase = caseMap[item.id];
      base.cases[item.id] = typeof rawCase === 'boolean' ? rawCase : false;
    }
  }

  return base;
};

const readState = async (): Promise<SessionTokenMatrixState> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyState();

  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyState();
  }
};

const writeState = async (state: SessionTokenMatrixState): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const useSessionTokenMatrix = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['takt-session-token-matrix'],
    queryFn: readState,
  });

  const update = useMutation({
    mutationFn: async (next: SessionTokenMatrixState) => {
      await writeState(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-session-token-matrix'], next);
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const next = emptyState();
      await writeState(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-session-token-matrix'], next);
    },
  });

  const data = query.data ?? emptyState();
  const done = SESSION_QA_CASES.filter((item) => data.cases[item.id]).length;
  const p0Total = SESSION_QA_CASES.filter((item) => item.priority === 'p0').length;
  const p0Done = SESSION_QA_CASES.filter((item) => item.priority === 'p0' && data.cases[item.id]).length;

  const patch = async (delta: Partial<SessionTokenMatrixState>) => {
    const next = {
      ...data,
      ...delta,
      cases: {
        ...data.cases,
        ...(delta.cases ?? {}),
      },
    };

    await update.mutateAsync(next);
  };

  const evidenceComplete =
    data.testerName.trim().length > 0 &&
    data.runDate.trim().length > 0 &&
    data.deviceSummary.trim().length > 0 &&
    data.appVersion.trim().length > 0;

  return {
    ...query,
    data,
    done,
    total: SESSION_QA_CASES.length,
    completionPct: Math.round((done / SESSION_QA_CASES.length) * 100),
    p0Done,
    p0Total,
    isSaving: update.isPending || reset.isPending,
    toggleCase: async (caseId: SessionQaCaseId) =>
      patch({
        cases: {
          ...data.cases,
          [caseId]: !data.cases[caseId],
        },
      }),
    updateMeta: async (
      delta: Partial<Pick<SessionTokenMatrixState, 'testerName' | 'runDate' | 'deviceSummary' | 'appVersion' | 'notes'>>,
    ) => patch(delta),
    reset: async () => reset.mutateAsync(),
    evidenceComplete,
    p0Pass: p0Done === p0Total,
    isReleasePass: p0Done === p0Total && evidenceComplete,
  };
};
