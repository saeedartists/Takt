# Takt — Family Sharing v1.0 Foundation (for v1.1 completion)

## Scope in v1.0
- Data model is in place.
- Relative read-only view skeleton is in place.
- Full consent flow (invite, acceptance, legal text per relative, revocation UX) is deferred to v1.1.

## Consent grant model
Each relative grant is one `Consent` resource.

### Grant shape
- `Consent.status = active`
- `Consent.patient.reference = Patient/<id>`
- `Consent.provision.type = permit`
- `Consent.provision.actor[0].reference.reference = RelatedPerson/<id>`
- `Consent.extension[]` contains:
  - `family-share/grant = true`
  - `family-share/granted-at = <ISO datetime>`
  - `family-share/granted-by = <Patient/... or Practitioner/...>`
  - optional `family-share/relationship-code`

### Revoke shape
- Same Consent instance updated via `PUT /Consent/:id`
- `Consent.status = inactive`
- Add extension fields:
  - `family-share/revoked-at`
  - `family-share/revoked-by`

This preserves a full audit trail of grant and revocation timestamps per relative.

## Permission scoping
Relative scope is read-only and patient-bound:
- Allowed:
  - View patient’s today doses
  - View status (scheduled, due, taken, skipped, missed)
  - Optional quiet unconfirmed reminder design (2h after schedule)
- Blocked:
  - Edit regimen
  - View diary entries
  - Generate/export patient doctor report

## Relative view skeleton
Route path: `Settings → Manage Family Sharing → Relative View (Preview)`

Relative screen includes:
- Patient’s today dose list and status only
- Explicit blocked-capability list
- No mutation actions

## v1.1 completion roadmap
1. Relative onboarding flow (`RelatedPerson` creation/invite/verification)
2. Per-relative explicit Article 9 consent UX and legal text acceptance
3. Revocation UX with confirmation and immediate permission withdrawal
4. Backend policy enforcement proof (read-scoped across all relevant endpoints)
5. Notification delivery policy and user controls for quiet reminders
