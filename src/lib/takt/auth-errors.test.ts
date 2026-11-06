import { OvokApiError } from '@ovok/core';
import { describe, expect, it } from 'vitest';

import { mapAuthError } from './auth-errors';

const t = ((key: string) => key) as Parameters<typeof mapAuthError>[2];

// Shapes copied from real @ovok/core 0.4.42 errors against api.sandbox.ovok.com (2026-11-07).
const apiError = (status: number, message: string) =>
  new OvokApiError({ status, code: undefined, message, fieldErrors: [], missing: [] }, undefined);

describe('mapAuthError', () => {
  it('names a too-common password instead of "Registration failed"', () => {
    const error = apiError(422, 'Password is too common. Choose one that is harder to guess.');
    expect(mapAuthError('register', error, t)).toBe('authPasswordTooCommon');
    expect(mapAuthError('reset', error, t)).toBe('authPasswordTooCommon');
  });

  it('uses the field code when the SDK provides it', () => {
    const error = new OvokApiError(
      { status: 422, code: undefined, message: 'The request has invalid fields.', fieldErrors: [{ code: 'PASSWORD_TOO_COMMON', message: '', path: ['password'] }], missing: [] },
      undefined,
    );
    expect(mapAuthError('register', error, t)).toBe('authPasswordTooCommon');
  });

  it('tells the user the email already has an account', () => {
    expect(mapAuthError('register', apiError(400, 'Registration failed.'), t)).toBe('authEmailTaken');
  });

  it('maps a 401 at sign-in to wrong credentials', () => {
    expect(mapAuthError('sign-in', apiError(401, 'Unauthorized'), t)).toBe('authInvalidCredentials');
  });

  it('maps rate limiting', () => {
    expect(mapAuthError('register', apiError(429, 'Too Many Requests'), t)).toBe('authTooManyAttempts');
  });

  it('falls back to the generic message for anything unknown', () => {
    expect(mapAuthError('register', new Error('boom'), t)).toBe('authErrorRegister');
  });
});
