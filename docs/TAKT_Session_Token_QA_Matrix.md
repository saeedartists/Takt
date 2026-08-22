# Takt — Session and Token Lifecycle QA Matrix

Goal: validate authentication/session behavior is predictable and safe across normal and failure paths.

## Preconditions
- Live backend tenant reachable.
- Patient login/registration enabled on tenant.
- Two patient accounts available for isolation checks.

## Test cases

| ID | Scenario | Steps | Expected result | Priority |
|---|---|---|---|---|
| ST-01 | Sign-in success | Sign in with valid credentials | Session established, protected routes available | P0 |
| ST-02 | Sign-in failure | Sign in with invalid password | Clear auth error, no protected access | P0 |
| ST-03 | Registration success | Register new patient account | Account created, session established or sign-in path provided | P0 |
| ST-04 | Registration duplicate email | Register with existing email | Clear duplicate-account error, no undefined state | P1 |
| ST-05 | Sign-out | Sign out from settings/account | Local token cleared, redirected to auth/consent gate | P0 |
| ST-06 | App restart with valid session | Sign in, restart app | Session restored without forcing re-login | P0 |
| ST-07 | App restart after sign-out | Sign out, restart app | Remains signed out | P0 |
| ST-08 | Expired/invalid token handling | Inject invalid token and open protected route | User is routed to sign-in and sees actionable message | P0 |
| ST-09 | Protected route guard | Open protected route without session | Access blocked; auth flow shown | P0 |
| ST-10 | Cross-account switch | Sign in as A, sign out, sign in as B | No stale A data shown after B login | P0 |
| ST-11 | Consent flow continuity | After auth, verify consent gating behavior | Consent flow appears only when required | P1 |
| ST-12 | Backend auth unavailable | Simulate unreachable auth endpoint | Setup/readiness messaging guides user without crash | P1 |

## Evidence log fields
For each case capture:
- platform (iOS/Android)
- device + OS
- build version
- case ID
- expected vs actual
- PASS/FAIL
- screenshot/video/log snippet
- defect ticket (if failed)

## Exit criteria
- All P0 cases pass on iOS and Android.
- Any P1 failure has documented mitigation and release decision.
