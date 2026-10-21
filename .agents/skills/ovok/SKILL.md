# Ovok skill (vendored per docs.ovok.com/working-with-ai-agents/ovok-skill)

Guidance for coding agents working on Takt, an Ovok app. Upstream skill source:
https://github.com/Actimi/ovok-landing/tree/main/skills/ovok
(`npx skills add Actimi/ovok-landing --skill ovok` could not run from this
environment — repo access restricted — so these behavioral rules are vendored
from the install page. Re-run the CLI installation when network access allows.)

## Before making changes

- Inspect the repository, its `AGENTS.md` instructions, framework, and existing code patterns.
- Use the current Ovok docs (https://docs.ovok.com — AI index at /llms.txt, page manifest at /llms/manifest.json) for the API route, FHIR resource, SDK method, request/response shape, and error behavior. For SDK methods, verify against the declarations shipped with the installed `@ovok/core` version (`node_modules/@ovok/core/dist/**/*.d.ts`), not just narrative docs.
- Identify project setup requirements an administrator must perform in the Console (authentication settings, AccessPolicies, feature switches, settings). Do not assume a documented SDK capability is enabled for the project — settings and AccessPolicies are authoritative, not the TypeScript surface.
- Use the Ovok MCP server (https://<environment>/mcp) or the Console only for project administration as an approved admin; use APIs/SDKs for application integrations.

## Boundaries

- Preserve tenant and patient boundaries; keep secrets, tenant codes beyond public config, and clinical data out of client code, logs, and prompts.
- `EXPO_PUBLIC_*` variables ship inside the app bundle — public configuration only.
- Flag any behavior that cannot be verified against the docs; never infer device measurement forwarding or Signals behavior.

## Deliverables

Report: the implementation, the Console setup an administrator must complete, and remaining assumptions.

## Doc anchors (Takt's verified surfaces)

- Client config: /web-sdk/core/client-configuration (baseUrl, `fhirUrlPath: '/fhir/R4/'`, trailing slash)
- Auth: /web-sdk/core/accounts-and-authentication → login()/register()/resetPassword()/setPasswordFromReset()/getSessions()/revokeSessions()/logout() — MFA via `nextStep === 'mfa'` + `verify(code)`
- Errors: /web-sdk/core/errors-and-retries — `readOvokError`, `isRateLimitError(retryAfterMs)`, retry only transient outcomes with backoff
- Runtime bootstrap: /native-sdk/components/polyfills — CommonJS entry polyfills BEFORE expo-router (Takt: /index.js)
- FHIR: /fhir-basics, /api/fhir/r4 — conditional creates for idempotent writes
- Tenancy: tokens are project-scoped; no `x-tenant-code` header exists in the contract
