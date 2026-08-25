import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const CONSENT_AUDIT_CHECKS = [
  'grant-created',
  'withdraw-created',
  'timeline-reviewed',
  'withdraw-route-confirmed',
  'evidence-exported',
  'legal-copy-reviewed',
] as const;

export type ConsentAuditCheckId = (typeof CONSENT_AUDIT_CHECKS)[number];

export type ConsentAuditVerdict = 'pending' | 'pass' | 'minor-edits' | 'fail';

export type ConsentAuditState = {
  testerName: string;
  reviewerRole: string;
  reviewDate: string;
  evidenceLinks: string;
  findings: string;
  verdict: ConsentAuditVerdict;
  checks: Record<ConsentAuditCheckId, boolean>;
};

const STORAGE_KEY = 'takt:consent-audit:v1';

const emptyState = (): ConsentAuditState => ({
  testerName: '',
  reviewerRole: '',
  reviewDate: '',
  evidenceLinks: '',
  findings: '',
  verdict: 'pending',
  checks: Object.fromEntries(CONSENT_AUDIT_CHECKS.map((id) => [id, false])) as Record<ConsentAuditCheckId, boolean>,
});

const sanitize = (raw: unknown): ConsentAuditState => {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;

  const value = raw as Record<string, unknown>;
  base.testerName = typeof value.testerName === 'string' ? value.testerName : '';
  base.reviewerRole = typeof value.reviewerRole === 'string' ? value.reviewerRole : '';
  base.reviewDate = typeof value.reviewDate === 'string' ? value.reviewDate : '';
  base.evidenceLinks = typeof value.evidenceLinks === 'string' ? value.evidenceLinks : '';
  base.findings = typeof value.findings === 'string' ? value.findings : '';

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
    for (const id of CONSENT_AUDIT_CHECKS) {
      const rawCheck = checks[id];
      base.checks[id] = typeof rawCheck === 'boolean' ? rawCheck : false;
    }
  }

  return base;
};

const readState = async (): Promise<ConsentAuditState> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyState();
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyState();
  }
};

const writeState = async (state: ConsentAuditState): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const useConsentAudit = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['takt-consent-audit'],
    queryFn: readState,
  });

  const update = useMutation({
    mutationFn: async (next: ConsentAuditState) => {
      await writeState(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-consent-audit'], next);
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const next = emptyState();
      await writeState(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['takt-consent-audit'], next);
    },
  });

  const data = query.data ?? emptyState();
  const done = CONSENT_AUDIT_CHECKS.filter((id) => data.checks[id]).length;

  const patch = async (delta: Partial<ConsentAuditState>) => {
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

  const metadataComplete =
    data.testerName.trim().length > 0 &&
    data.reviewerRole.trim().length > 0 &&
    data.reviewDate.trim().length > 0 &&
    data.evidenceLinks.trim().length > 0;

  return {
    ...query,
    data,
    done,
    total: CONSENT_AUDIT_CHECKS.length,
    completionPct: Math.round((done / CONSENT_AUDIT_CHECKS.length) * 100),
    metadataComplete,
    isSaving: update.isPending || reset.isPending,
    toggleCheck: async (id: ConsentAuditCheckId) =>
      patch({
        checks: {
          ...data.checks,
          [id]: !data.checks[id],
        },
      }),
    setVerdict: async (verdict: ConsentAuditVerdict) => patch({ verdict }),
    updateMeta: async (
      delta: Partial<
        Pick<ConsentAuditState, 'testerName' | 'reviewerRole' | 'reviewDate' | 'evidenceLinks' | 'findings'>
      >,
    ) => patch(delta),
    reset: async () => reset.mutateAsync(),
  };
};
