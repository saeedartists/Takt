import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const REPORT_REVIEW_CHECKS = [
  'a-identity-clear',
  'a-window-clear',
  'a-adherence-readable',
  'a-medication-actionable',
  'a-missed-risk-clear',
  'b-no-treatment-recommendation',
  'b-boundary-clear',
  'b-disclaimer-clear',
  'c-one-page-practical',
  'c-readability-print',
  'c-terminology-fit',
  'c-density-balanced',
  'd-en-natural',
  'd-de-natural',
  'd-no-translation-drift',
] as const;

export type ReportReviewCheckId = (typeof REPORT_REVIEW_CHECKS)[number];

export type ReportReviewVerdict = 'pending' | 'pass' | 'minor-edits' | 'fail';

export type ReportReviewState = {
  reviewerName: string;
  reviewerRole: string;
  reviewerSpecialty: string;
  reviewDate: string;
  sampleCount: string;
  evidenceLinks: string;
  requiredChanges: string;
  priorityBeforeRelease: string;
  optionalPostV1: string;
  verdict: ReportReviewVerdict;
  checks: Record<ReportReviewCheckId, boolean>;
};

const STORAGE_KEY = 'takt:report-review:v1';

const emptyState = (): ReportReviewState => ({
  reviewerName: '',
  reviewerRole: '',
  reviewerSpecialty: '',
  reviewDate: '',
  sampleCount: '',
  evidenceLinks: '',
  requiredChanges: '',
  priorityBeforeRelease: '',
  optionalPostV1: '',
  verdict: 'pending',
  checks: Object.fromEntries(REPORT_REVIEW_CHECKS.map((id) => [id, false])) as Record<ReportReviewCheckId, boolean>,
});

const sanitize = (raw: unknown): ReportReviewState => {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;

  const value = raw as Record<string, unknown>;
  base.reviewerName = typeof value.reviewerName === 'string' ? value.reviewerName : '';
  base.reviewerRole = typeof value.reviewerRole === 'string' ? value.reviewerRole : '';
  base.reviewerSpecialty = typeof value.reviewerSpecialty === 'string' ? value.reviewerSpecialty : '';
  base.reviewDate = typeof value.reviewDate === 'string' ? value.reviewDate : '';
  base.sampleCount = typeof value.sampleCount === 'string' ? value.sampleCount : '';
  base.evidenceLinks = typeof value.evidenceLinks === 'string' ? value.evidenceLinks : '';
  base.requiredChanges = typeof value.requiredChanges === 'string' ? value.requiredChanges : '';
  base.priorityBeforeRelease = typeof value.priorityBeforeRelease === 'string' ? value.priorityBeforeRelease : '';
  base.optionalPostV1 = typeof value.optionalPostV1 === 'string' ? value.optionalPostV1 : '';

  if (
    value.verdict === 'pending' ||
    value.verdict === 'pass' ||
    value.verdict === 'minor-edits' ||
    value.verdict === 'fail'
  ) {
    base.verdict = value.verdict;
  }

  if (value.checks && typeof value.checks === 'object') {
    const checks = value.checks as Record<string, unknown>;
    for (const id of REPORT_REVIEW_CHECKS) {
      const rawCheck = checks[id];
      base.checks[id] = typeof rawCheck === 'boolean' ? rawCheck : false;
    }
  }

  return base;
};

const readState = async (): Promise<ReportReviewState> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyState();

  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyState();
  }
};

const writeState = async (state: ReportReviewState): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const useReportReview = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['takt-report-review'],
    queryFn: readState,
  });

  const update = useMutation({
    mutationFn: async (next: ReportReviewState) => {
      await writeState(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-report-review'], next);
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const next = emptyState();
      await writeState(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-report-review'], next);
    },
  });

  const data = query.data ?? emptyState();
  const done = REPORT_REVIEW_CHECKS.filter((id) => data.checks[id]).length;

  const patch = async (delta: Partial<ReportReviewState>) => {
    const next = {
      ...data,
      ...delta,
      checks: {
        ...data.checks,
        ...(delta.checks ?? {}),
      },
    };

    await update.mutateAsync(next);
  };

  const reviewerMetaComplete =
    data.reviewerName.trim().length > 0 &&
    data.reviewerRole.trim().length > 0 &&
    data.reviewDate.trim().length > 0 &&
    data.sampleCount.trim().length > 0 &&
    data.evidenceLinks.trim().length > 0;

  const allChecksDone = done === REPORT_REVIEW_CHECKS.length;
  const releasePass = allChecksDone && reviewerMetaComplete && (data.verdict === 'pass' || data.verdict === 'minor-edits');

  return {
    ...query,
    data,
    done,
    total: REPORT_REVIEW_CHECKS.length,
    completionPct: Math.round((done / REPORT_REVIEW_CHECKS.length) * 100),
    reviewerMetaComplete,
    allChecksDone,
    releasePass,
    isSaving: update.isPending || reset.isPending,
    toggleCheck: async (id: ReportReviewCheckId) =>
      patch({
        checks: {
          ...data.checks,
          [id]: !data.checks[id],
        },
      }),
    setVerdict: async (verdict: ReportReviewVerdict) => patch({ verdict }),
    updateMeta: async (
      delta: Partial<
        Pick<
          ReportReviewState,
          | 'reviewerName'
          | 'reviewerRole'
          | 'reviewerSpecialty'
          | 'reviewDate'
          | 'sampleCount'
          | 'evidenceLinks'
          | 'requiredChanges'
          | 'priorityBeforeRelease'
          | 'optionalPostV1'
        >
      >,
    ) => patch(delta),
    reset: async () => reset.mutateAsync(),
  };
};
