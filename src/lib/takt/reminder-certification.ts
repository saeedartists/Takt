import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const REMINDER_CASE_IDS = [
  'a1-ios-overnight',
  'a2-android-overnight',
  'b1-ios-reboot',
  'b2-android-reboot',
  'c1-timezone-shift',
  'c2-dst-alignment',
  'd1-edit-reconciliation',
  'd2-pause-reconciliation',
  'd3-archive-reconciliation',
  'e1-snooze-reliability',
] as const;

export type ReminderCaseId = (typeof REMINDER_CASE_IDS)[number];

export type ReminderCertificationState = {
  testerName: string;
  runDate: string;
  deviceSummary: string;
  appVersion: string;
  notes: string;
  evidenceLinks: string;
  cases: Record<ReminderCaseId, boolean>;
};

const STORAGE_KEY = 'takt:reminder-certification:v1';

const emptyState = (): ReminderCertificationState => ({
  testerName: '',
  runDate: '',
  deviceSummary: '',
  appVersion: '',
  notes: '',
  evidenceLinks: '',
  cases: Object.fromEntries(REMINDER_CASE_IDS.map((id) => [id, false])) as Record<ReminderCaseId, boolean>,
});

const sanitize = (raw: unknown): ReminderCertificationState => {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;

  const value = raw as Record<string, unknown>;
  base.testerName = typeof value.testerName === 'string' ? value.testerName : '';
  base.runDate = typeof value.runDate === 'string' ? value.runDate : '';
  base.deviceSummary = typeof value.deviceSummary === 'string' ? value.deviceSummary : '';
  base.appVersion = typeof value.appVersion === 'string' ? value.appVersion : '';
  base.notes = typeof value.notes === 'string' ? value.notes : '';
  base.evidenceLinks = typeof value.evidenceLinks === 'string' ? value.evidenceLinks : '';

  if (value.cases && typeof value.cases === 'object') {
    const caseMap = value.cases as Record<string, unknown>;
    for (const id of REMINDER_CASE_IDS) {
      base.cases[id] = typeof caseMap[id] === 'boolean' ? caseMap[id] : false;
    }
  }

  return base;
};

const readState = async (): Promise<ReminderCertificationState> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyState();

  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyState();
  }
};

const writeState = async (state: ReminderCertificationState): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const useReminderCertification = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['takt-reminder-certification'],
    queryFn: readState,
  });

  const update = useMutation({
    mutationFn: async (next: ReminderCertificationState) => {
      await writeState(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-reminder-certification'], next);
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const next = emptyState();
      await writeState(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-reminder-certification'], next);
    },
  });

  const data = query.data ?? emptyState();
  const done = REMINDER_CASE_IDS.filter((id) => data.cases[id]).length;

  const patch = async (delta: Partial<ReminderCertificationState>) => {
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

  const iosOvernightPass = data.cases['a1-ios-overnight'];
  const androidOvernightPass = data.cases['a2-android-overnight'];
  const timezoneDstPass = data.cases['c1-timezone-shift'] && data.cases['c2-dst-alignment'];

  return {
    ...query,
    data,
    done,
    total: REMINDER_CASE_IDS.length,
    completionPct: Math.round((done / REMINDER_CASE_IDS.length) * 100),
    isSaving: update.isPending || reset.isPending,
    toggleCase: async (caseId: ReminderCaseId) =>
      patch({
        cases: {
          ...data.cases,
          [caseId]: !data.cases[caseId],
        },
      }),
    updateMeta: async (
      delta: Partial<Pick<ReminderCertificationState, 'testerName' | 'runDate' | 'deviceSummary' | 'appVersion' | 'evidenceLinks' | 'notes'>>,
    ) => patch(delta),
    reset: async () => reset.mutateAsync(),
    iosOvernightPass,
    androidOvernightPass,
    timezoneDstPass,
    isEvidenceComplete:
      data.testerName.trim().length > 0 &&
      data.runDate.trim().length > 0 &&
      data.deviceSummary.trim().length > 0 &&
      data.appVersion.trim().length > 0 &&
      data.evidenceLinks.trim().length > 0,
  };
};
