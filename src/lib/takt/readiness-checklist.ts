import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const READINESS_TASK_IDS = [
  'auth-live-smoke',
  'patient-isolation',
  'reminder-ios-closed',
  'reminder-android-closed',
  'timezone-dst',
  'report-pdf-reviewed',
  'consent-audit',
  'a11y-pass',
] as const;

export type ReadinessTaskId = (typeof READINESS_TASK_IDS)[number];

const STORAGE_KEY = 'takt:readiness:checklist:v1';

export type ReadinessChecklistState = Record<ReadinessTaskId, boolean>;

const baseState = (): ReadinessChecklistState =>
  Object.fromEntries(READINESS_TASK_IDS.map((id) => [id, false])) as ReadinessChecklistState;

const sanitize = (raw: unknown): ReadinessChecklistState => {
  const next = baseState();
  if (!raw || typeof raw !== 'object') return next;

  for (const id of READINESS_TASK_IDS) {
    const value = (raw as Record<string, unknown>)[id];
    if (typeof value === 'boolean') {
      next[id] = value;
    }
  }

  return next;
};

const readChecklist = async (): Promise<ReadinessChecklistState> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return baseState();

  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return baseState();
  }
};

const writeChecklist = async (state: ReadinessChecklistState): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const useReadinessChecklist = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['takt-readiness-checklist'],
    queryFn: readChecklist,
  });

  const toggle = useMutation({
    mutationFn: async (taskId: ReadinessTaskId) => {
      const current = await readChecklist();
      const next = { ...current, [taskId]: !current[taskId] };
      await writeChecklist(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-readiness-checklist'], next);
    },
  });

  const setTask = useMutation({
    mutationFn: async ({ taskId, done }: { taskId: ReadinessTaskId; done: boolean }) => {
      const current = await readChecklist();
      const next = { ...current, [taskId]: done };
      await writeChecklist(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-readiness-checklist'], next);
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const next = baseState();
      await writeChecklist(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-readiness-checklist'], next);
    },
  });

  const data = query.data ?? baseState();
  const total = READINESS_TASK_IDS.length;
  const done = READINESS_TASK_IDS.filter((id) => data[id]).length;

  return {
    ...query,
    data,
    total,
    done,
    completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
    toggleTask: async (taskId: ReadinessTaskId) => toggle.mutateAsync(taskId),
    setTaskStatus: async (taskId: ReadinessTaskId, done: boolean) =>
      setTask.mutateAsync({ taskId, done }),
    resetChecklist: async () => reset.mutateAsync(),
    isSaving: toggle.isPending || reset.isPending || setTask.isPending,
  };
};
