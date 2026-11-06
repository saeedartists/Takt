import { isRegistrationFailed, readOvokError } from '@ovok/core';

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
  t: (key: 'authErrorSignIn' | 'authErrorRegister' | 'authErrorReset' | 'authBackendNotReadyBody' | 'authInvalidCredentials' | 'authRegistrationDisabled' | 'authMissingClientId' | 'authTenantMissing' | 'authGenericRetry' | 'authPasswordTooCommon' | 'authPasswordTooShort' | 'authEmailTaken' | 'authTooManyAttempts') => string,
): string => {
  const message = messageFromError(error);

  // Ovok's specific reason lives in the problem body (errors[].code), not in
  // the message; without this every refusal read as "Registration failed".
  // @ovok/core 0.4.42 drops Ovok's {field, code} entries (fieldErrors comes back
  // empty) but keeps a readable message, so match the code first, then the message.
  const details = readOvokError(error);
  const fieldCodes = details.fieldErrors.map((field) => field.code);
  const detail = details.message || message;
  if (fieldCodes.includes('PASSWORD_TOO_COMMON') || /password is too common/i.test(detail)) {
    return t('authPasswordTooCommon');
  }
  if (fieldCodes.includes('FIELD_TOO_SHORT') || /at least \d+ characters|too short/i.test(detail)) {
    return t('authPasswordTooShort');
  }
  if (details.status === 429) return t('authTooManyAttempts');
  if (kind === 'register' && isRegistrationFailed(error)) return t('authEmailTaken');
  // The SDK reduces "Invalid email or password." to a bare 401 "Unauthorized".
  if (kind === 'sign-in' && details.status === 401) return t('authInvalidCredentials');

  if (isBackendAuthNotReady(message)) {
    return t('authBackendNotReadyBody');
  }

  if (/(username|email)\s+or\s+password\s+is\s+incorrect|invalid\s+email\s+or\s+password/i.test(message)) {
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
