/*
 * Env access for the Expo app. EXPO_PUBLIC_* vars are inlined at build
 * time by Expo, so they're safe to reference from any client code.
 */

const rawMockFlag = process.env.EXPO_PUBLIC_OVOK_MOCK ?? '';

export const env = {
  ovokApiUrl: process.env.EXPO_PUBLIC_OVOK_API_URL ?? 'https://api.ovok.com',
  ovokTenantCode: process.env.EXPO_PUBLIC_OVOK_TENANT_CODE ?? '',
  ovokClientId: process.env.EXPO_PUBLIC_OVOK_CLIENT_ID ?? '',
  /**
   * Google OAuth client ID used by the SDK's social-login flow. Fill in
   * from the Google Cloud console (OAuth 2.0 → iOS/Android client) then
   * re-run `expo prebuild --clean` so the entitlement lands in native.
   */
  googleSocialLoginClientId:
    process.env.EXPO_PUBLIC_GOOGLE_SOCIAL_LOGIN_CLIENT_ID ?? '',
  ovokMockEnabled:
    rawMockFlag === '1' || rawMockFlag.toLowerCase() === 'true',
} as const;

export const hasLiveBackendConfig = (): boolean =>
  Boolean(env.ovokApiUrl) && Boolean(env.ovokTenantCode);
