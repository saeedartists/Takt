import { OvokClient } from '@ovok/core';
import { env } from './env';

/*
 * Single OvokClient instance used by <OvokProvider>.
 *
 * We intentionally avoid importing storage helpers from @ovok/native here so
 * Expo web bundling in the sandbox does not pull native-only PDF modules.
 */
export const ovokClient = new OvokClient({
  baseUrl: env.ovokApiUrl,
  fhirUrlPath: '/fhir',
  socialLoginClientId: env.googleSocialLoginClientId,
});
