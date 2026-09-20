# Takt — Family Sharing (v1.1)

Status 2026-09-20: client side complete and verified in mock mode. Two items need the Ovok platform before it works between two real accounts (see "Server-side requirements").

## The flow (product brief §11)

1. **Invite.** The patient opens Settings → Family sharing, enters the relative's name, e-mail and relationship, and ticks a separate, affirmative consent statement for that one person. Takt creates one `RelatedPerson` (with the e-mail as `telecom`) and one active `Consent` (`policyRule.text = takt-family-sharing-v1`, actor = the RelatedPerson, grant time and grantor recorded as extensions). The list then shows "Invited · waiting for ‹e-mail› to accept".
2. **Accept.** The relative signs in on their own phone. Takt looks up `RelatedPerson?email=‹their account e-mail›`, finds an active family-share Consent for it, and shows "‹Patient› wants to share their medication times with you" on their Today screen. Accepting writes the relative's own `Patient` reference onto the RelatedPerson (`family-share/linked-account`, `family-share/accepted-at`). Nothing is copied into the relative's account: the link is a permission on the patient's record.
3. **View.** The relative's Today shows a "Shared with you" row per patient with one status line ("All doses confirmed so far today" or "N unconfirmed for over 2 hours"). Opening it shows today's doses for that patient with status only, doses unconfirmed for 2h+ flagged, and the blocked-capability list. No actions exist on the screen.
4. **Revoke.** The patient revokes in one step (two taps: revoke, confirm). The Consent becomes `inactive` with revocation time and revoker recorded; the relative's view re-checks the grant every time it is focused and shows "Access is revoked".

## Data model

| Concept | Resource | Detail |
|---|---|---|
| Relative | `RelatedPerson` | `patient` = the sharing patient; `telecom.email` = invitation address; extensions `family-share/linked-account` (relative's Patient) and `family-share/accepted-at` once accepted |
| Grant | `Consent` | One per relative; `status` active/inactive; extensions `family-share/grant`, `granted-at`, `granted-by`, `relationship-code`, `revoked-at`, `revoked-by` |
| Permission scope | code (`family-sharing.ts`) | relative: view-today-doses, view-dose-status, receive-unconfirmed-reminder; blocked: edit-regimen, view-diary, export-doctor-report |
| Unconfirmed rule | `isUnconfirmedForHours` | dose not taken and not skipped, 2 hours after its scheduled time |

Verified by `npm run verify:fhir` (Consent and RelatedPerson shapes, revoke marker) and the mock walkthrough (Amara Okonkwo invites the demo account Camila Reyes as caregiver; Camila accepts and reads Amara's doses).

## Server-side requirements (Ovok)

1. **Access policy for relatives.** By default a patient account can read only its own compartment. The relative's account must be allowed to read the sharing patient's `Patient`, `MedicationRequest`, `Medication` and `MedicationAdministration` **when** an active `Consent` with `policyRule.text = takt-family-sharing-v1` names a `RelatedPerson` whose `family-share/linked-account` is the requester's Patient, and to read/search `RelatedPerson` by its own e-mail. Nothing else: no diary (`Observation`), no write access. In Medplum terms this is an `AccessPolicy` on the relative's project membership with resource-level criteria. Until this exists, the relative's requests return 403 outside mock mode.
2. **Quiet notification (optional per brief).** "One quiet notification if a dose is still unconfirmed two hours after its scheduled time — one per dose, never a stream." The device cannot know remotely whether the patient confirmed, so a local schedule would produce false alarms. This belongs in an Ovok bot: every 15 minutes, for each active family-share Consent, find the patient's doses due more than 2h ago with no `MedicationAdministration`, and send one push per dose key to the linked relative (dedupe on `requestId|date|time`). The app already shows the same information in-app (the status line and the 2h+ badge); the bot only adds the push.

## Not in scope

Editing the patient's regimen, the diary, or the doctor report from the relative's account, and any relative-to-patient messaging.
