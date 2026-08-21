import { OvokClient } from '@ovok/core';
import { ExpoClientStorage } from '@ovok/native';
import { env } from './env';

/*
 * Single OvokClient instance used by <OvokProvider> and auth flows.
 * Uses ExpoClientStorage so session tokens survive app restarts.
 */
export const ovokClient = new OvokClient({
  storage: new ExpoClientStorage(),
  baseUrl: env.ovokApiUrl,
  fhirUrlPath: '/fhir',
  socialLoginClientId: env.googleSocialLoginClientId,
});
