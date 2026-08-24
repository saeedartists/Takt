import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const ISOLATION_CASE_IDS = [
  'a-reads-a',
  'a-reads-b-denied',
  'a-writes-b-denied',
  'b-reads-b',
  'b-reads-a-denied',
  'b-writes-a-denied',
] as const;

export type IsolationCaseId = (typeof ISOLATION_CASE_IDS)[number];

export type IsolationMatrixState = {
  testerName: string;
  runDate: string;
  notes: string;
  cases: Record<IsolationCaseId, boolean>;
};

const STORAGE_KEY = 'takt:isolation-matrix:v1';

const emptyState = (): IsolationMatrixState => ({
  testerName: '',
  runDate: '',
  notes: '',
  cases: Object.fromEntries(ISOLATION_CASE_IDS.map((id) => [id, false])) as Record<IsolationCaseId, boolean>,
});

const sanitize = (raw: unknown): IsolationMatrixState => {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;

  const value = raw as Record<string, unknown>;
  base.testerName = typeof value.testerName === 'string' ? value.testerName : '';
  base.runDate = typeof value.runDate === 'string' ? value.runDate : '';
  base.notes = typeof value.notes === 'string' ? value.notes : '';

  if (value.cases && typeof value.cases === 'object') {
    const caseMap = value.cases as Record<string, unknown>;
    for (const id of ISOLATION_CASE_IDS) {
      base.cases[id] = typeof caseMap[id] === 'boolean' ? caseMap[id] : false;
    }
  }

  return base;
};

const readState = async (): Promise<IsolationMatrixState> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyState();

  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyState();
  }
};

const writeState = async (state: IsolationMatrixState): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const useIsolationMatrix = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['takt-isolation-matrix'],
    queryFn: readState,
  });

  const update = useMutation({
    mutationFn: async (next: IsolationMatrixState) => {
      await writeState(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-isolation-matrix'], next);
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const next = emptyState();
      await writeState(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-isolation-matrix'], next);
    },
  });

  const data = query.data ?? emptyState();
  const done = ISOLATION_CASE_IDS.filter((id) => data.cases[id]).length;
  const completionPct = Math.round((done / ISOLATION_CASE_IDS.length) * 100);

  const patch = async (delta: Partial<IsolationMatrixState>) => {
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

  return {
    ...query,
    data,
    done,
    total: ISOLATION_CASE_IDS.length,
    completionPct,
    isSaving: update.isPending || reset.isPending,
    toggleCase: async (caseId: IsolationCaseId) =>
      patch({
        cases: {
          ...data.cases,
          [caseId]: !data.cases[caseId],
        },
      }),
    updateMeta: async (delta: Partial<Pick<IsolationMatrixState, 'testerName' | 'runDate' | 'notes'>>) =>
      patch(delta),
    reset: async () => reset.mutateAsync(),
    isPass:
      done === ISOLATION_CASE_IDS.length && data.testerName.trim().length > 0 && data.runDate.trim().length > 0,
  };
};
