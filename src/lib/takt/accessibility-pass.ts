import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const A11Y_CASE_IDS = [
  'a-large-text-today',
  'b-large-text-medications',
  'c-large-text-history',
  'd-screen-reader-tab-flow',
  'e-screen-reader-dose-actions',
  'f-non-color-status-cues',
  'g-focus-order-critical-flows',
  'h-rotation-layout-stability',
] as const;

export type A11yCaseId = (typeof A11Y_CASE_IDS)[number];

export type AccessibilityPassState = {
  testerName: string;
  runDate: string;
  deviceSummary: string;
  assistiveTechUsed: string;
  notes: string;
  cases: Record<A11yCaseId, boolean>;
};

const STORAGE_KEY = 'takt:accessibility-pass:v1';

const emptyState = (): AccessibilityPassState => ({
  testerName: '',
  runDate: '',
  deviceSummary: '',
  assistiveTechUsed: '',
  notes: '',
  cases: Object.fromEntries(A11Y_CASE_IDS.map((id) => [id, false])) as Record<A11yCaseId, boolean>,
});

const sanitize = (raw: unknown): AccessibilityPassState => {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;

  const value = raw as Record<string, unknown>;
  base.testerName = typeof value.testerName === 'string' ? value.testerName : '';
  base.runDate = typeof value.runDate === 'string' ? value.runDate : '';
  base.deviceSummary = typeof value.deviceSummary === 'string' ? value.deviceSummary : '';
  base.assistiveTechUsed = typeof value.assistiveTechUsed === 'string' ? value.assistiveTechUsed : '';
  base.notes = typeof value.notes === 'string' ? value.notes : '';

  if (value.cases && typeof value.cases === 'object') {
    const caseMap = value.cases as Record<string, unknown>;
    for (const id of A11Y_CASE_IDS) {
      base.cases[id] = typeof caseMap[id] === 'boolean' ? caseMap[id] : false;
    }
  }

  return base;
};

const readState = async (): Promise<AccessibilityPassState> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyState();

  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyState();
  }
};

const writeState = async (state: AccessibilityPassState): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const useAccessibilityPass = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['takt-accessibility-pass'],
    queryFn: readState,
  });

  const update = useMutation({
    mutationFn: async (next: AccessibilityPassState) => {
      await writeState(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-accessibility-pass'], next);
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const next = emptyState();
      await writeState(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-accessibility-pass'], next);
    },
  });

  const data = query.data ?? emptyState();
  const done = A11Y_CASE_IDS.filter((id) => data.cases[id]).length;

  const patch = async (delta: Partial<AccessibilityPassState>) => {
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
    data.assistiveTechUsed.trim().length > 0;

  return {
    ...query,
    data,
    done,
    total: A11Y_CASE_IDS.length,
    completionPct: Math.round((done / A11Y_CASE_IDS.length) * 100),
    isSaving: update.isPending || reset.isPending,
    toggleCase: async (caseId: A11yCaseId) =>
      patch({
        cases: {
          ...data.cases,
          [caseId]: !data.cases[caseId],
        },
      }),
    updateMeta: async (
      delta: Partial<Pick<AccessibilityPassState, 'testerName' | 'runDate' | 'deviceSummary' | 'assistiveTechUsed' | 'notes'>>,
    ) => patch(delta),
    reset: async () => reset.mutateAsync(),
    evidenceComplete,
    isPass: done === A11Y_CASE_IDS.length && evidenceComplete,
  };
};
