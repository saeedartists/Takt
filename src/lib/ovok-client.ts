import { OvokClient } from '@ovok/core';
import { ExpoClientStorage } from '@ovok/native';
import { env } from './env';

/*
 * OvokClient — the single client instance the app talks to Ovok
 * through. Passed to <OvokProvider> at the app root; every @ovok/native
 * hook + component reaches it via React context.
 *
 * ExpoClientStorage adapts expo-secure-store to the client's storage
 * contract (persist auth tokens across cold starts, wipe on sign-out).
 * baseUrl targets the tenant-specific Ovok deployment; fhirUrlPath is
 * the standard '/fhir' prefix on ovok-core.
 */
export const ovokClient = new OvokClient({
  storage: new ExpoClientStorage(),
  baseUrl: env.ovokApiUrl,
  fhirUrlPath: '/fhir',
  socialLoginClientId: env.googleSocialLoginClientId,
});

/*
 * NOTE — `tenantCode` is deliberately NOT passed here.
 *
 * `OvokClient`'s constructor is
 * `MedplumClientOptions & { socialLoginClientId?: string }`
 * (@ovok/core@0.2.5x, dist/client/ovok-client.d.ts). There is no
 * `tenantCode` option, so passing it did not typecheck AND was
 * silently dropped at runtime — tenant targeting never actually took
 * effect from here.
 *
 * The tenant code belongs on the LOGIN call, not on client
 * construction. Per the SDK's auth surface, `loginType: 'Patient'`
 * requires `tenantCode` and `'Practitioner'` treats it as optional:
 *
 *   <LoginForm loginType="Patient" tenantCode={env.ovokTenantCode} />
 *
 * `env.ovokTenantCode` stays exported from ./env for exactly that.
 */
