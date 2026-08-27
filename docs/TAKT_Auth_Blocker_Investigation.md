# Takt — Auth Blocker Investigation (`key-not-found`)

Date: 2026-08-27
Owner: Builder execution trace

## Objective
Unblock tenant patient auth settings so live sign-in/registration smoke tests can pass.

## Findings

### 1) Current settings state
`lookup_ovok_settings` reports both patient auth toggles are disabled:
- `PATIENT_LOGIN_ENABLED = false`
- `PATIENT_REGISTRATION_ENABLED = false`

### 2) Reproduced write failure
Attempted writes via typed settings tool:
- `update_ovok_setting(PATIENT_LOGIN_ENABLED=true)` → `ok:false`, `reason:key-not-found`
- `update_ovok_setting(PATIENT_REGISTRATION_ENABLED=true)` → `ok:false`, `reason:key-not-found`

### 3) Root cause location (effective)
The Builder settings-update path expects key-scoped update capability that is not available on this tenant API surface.
Observed behavior:
- `GET /v1/project/settings` works (aggregate read)
- `GET/PUT /v1/project/settings/:key` returns 404 on this backend

This mismatch triggers the tool-level `key-not-found` outcome.

### 4) Live auth smoke evidence
- `POST /auth/tenant/Patient/register` returns `403 Registration is not enabled for this project.`
- Live registration remains blocked until settings write path is restored.

## Status
- **Blocked externally** (tenant/backend settings write endpoint mismatch).
- App-side diagnostics are in place; backend enablement is the blocker.

## Resolution criteria
To close this blocker, backend must support one of:
1. key-scoped settings write endpoint expected by Builder tools, or
2. an alternate supported write contract that Builder tools are updated to use.

After endpoint fix:
1. Set both patient flags to true.
2. Re-run live registration smoke.
3. Re-run live sign-in smoke with created account.
