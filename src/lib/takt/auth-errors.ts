const isBackendAuthNotReady = (message: string): boolean =>
  /(cannot\s+post|not\s+found|404|disabled|forbidden|not enabled|unavailable)/i.test(message);

export type AuthFlowKind = 'sign-in' | 'register' | 'reset';

const messageFromError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '';
};

export const mapAuthError = (
  kind: AuthFlowKind,
  error: unknown,
  t: (key: 'authErrorSignIn' | 'authErrorRegister' | 'authErrorReset' | 'authBackendNotReadyBody' | 'authInvalidCredentials' | 'authRegistrationDisabled' | 'authMissingClientId' | 'authTenantMissing' | 'authGenericRetry') => string,
): string => {
  const message = messageFromError(error);

  if (isBackendAuthNotReady(message)) {
    return t('authBackendNotReadyBody');
  }

  if (/username\s+or\s+password\s+is\s+incorrect/i.test(message)) {
    return t('authInvalidCredentials');
  }

  if (/registration\s+is\s+not\s+enabled/i.test(message)) {
    return t('authRegistrationDisabled');
  }

  if (/client\s*id\s+is\s+required/i.test(message)) {
    return t('authMissingClientId');
  }

  if (/tenant\s*code/i.test(message)) {
    return t('authTenantMissing');
  }

  if (kind === 'sign-in') {
    return t('authErrorSignIn');
  }

  if (kind === 'register') {
    return t('authErrorRegister');
  }

  if (kind === 'reset') {
    return t('authErrorReset');
  }

  return t('authGenericRetry');
};
