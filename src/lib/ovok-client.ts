import { OvokClient } from '@ovok/core';
import { ExpoClientStorage } from '@medplum/expo-polyfills';
import { env } from './env';

/*
 * Single OvokClient instance used by <OvokProvider> and auth flows.
 * Uses ExpoClientStorage so session tokens survive app restarts.
 */
export const ovokClient = new OvokClient({
  storage: new ExpoClientStorage(),
  baseUrl: env.ovokApiUrl,
  // Trailing slash required; must match the /fhir/R4/ surface FhirRepository
  // hits directly (Ovok docs → configure the client).
  fhirUrlPath: '/fhir/R4/',
  socialLoginClientId: env.ovokClientId,
});
