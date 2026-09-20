# Takt — Data Protection Impact Assessment (draft)

Status: draft prepared alongside the build (Product Brief §8: "far cheaper to draft alongside the build than to reconstruct afterwards"). Not a blocker for an internal Actimi Appstore release; must be completed and signed before any public store launch. Sections marked **[legal]** need the data-protection officer or counsel.

## 1. Description of the processing

| Item | Value |
|---|---|
| Controller | Actimi GmbH **[legal: confirm entity, address, DPO contact]** |
| Processor | Ovok (health platform: FHIR API, EU hosting, tenant isolation at the API layer) **[legal: reference the Art. 28 processing agreement]** |
| Product | Takt, a medication reminder and adherence log for consumers |
| Data subjects | Adults managing their own medication; in v1.1 also relatives granted a read-only view |
| Nature | Storage of self-reported medication plans and dose events; local reminders; PDF report generated on the user's device at the user's request |
| Scope | One FHIR `Patient` per account; `Medication`, `MedicationRequest`, `MedicationAdministration`, `Consent` resources; optional `RelatedPerson` + `Consent` per family-sharing grant (v1.1) |
| Context | The user enters everything; no import from other systems, no sensors, no drug database |
| Purpose | Remind the user at their chosen times, keep the record they report, produce the report they choose to share |

## 2. Data inventory

| Category | Fields | Where | Retention |
|---|---|---|---|
| Identity | Name, account e-mail (auth) | Ovok, EU | Until account deletion |
| Health (Art. 9) | Medication name, form, strength, schedule, pause periods; each dose taken / skipped / missed with scheduled and actual time | Ovok, EU | Until account deletion or consent withdrawal |
| Consent record | Version identifier, timestamp, status (active / inactive) | Ovok, EU | Kept as audit trail after withdrawal **[legal: confirm]** |
| Family-sharing grant (v1.1) | Relative's name and relationship, grant and revocation timestamps | Ovok, EU | Until revoked; revocation recorded |
| Preferences | Language, theme, snooze length, reminder sound | Device only | Until app deletion |
| Supply tracking | Tablet count and last refill date per medication | Device only | Until app deletion |
| Reminder bookkeeping | Scheduled notification ids, permission state, diagnostic event log (no health content) | Device only | Rolling; capped |
| Exported report | PDF or CSV | Created on device, handed to the OS share sheet | Not kept by Takt |

Not processed: location, contacts, photos, sensor data, advertising identifiers, analytics events on health screens, crash reports containing health data.

## 3. Legal basis

- Health data: explicit consent, Art. 9(2)(a) GDPR, obtained on a dedicated first-run screen that is unbundled from terms and cannot be pre-ticked. The consent is stored as its own FHIR `Consent` resource with version and timestamp. Withdrawal is one action in Settings, takes effect immediately, and stops further processing.
- Family sharing (v1.1): a separate explicit consent per grant, revocable in one step, each modelled as its own `Consent` resource. The relative's view is a permission on the patient's record, never a copy into the relative's account.
- Account data: Art. 6(1)(b) (contract) for authentication only.

## 4. Necessity and proportionality

- Data minimisation: only the schedule, the dose events and the consent record are stored server-side. Preferences and supply counts never leave the device.
- No profiling, scoring, weighting or automated decision-making. The adherence percentage is `taken ÷ (taken + skipped + missed)` over a stated window, shown to the user and printed on their report; it is not transmitted anywhere else and is not used to trigger any action.
- No third-party SDKs on health screens. No advertising. No transfers outside the EEA.
- Reminders are scheduled on the device by the operating system; no server sees when a dose is due.

## 5. Risks and measures

| Risk | Likelihood | Severity | Measures |
|---|---|---|---|
| Unauthorised access to the account | Low | High | Ovok authentication, tokens in the OS secure store, session expiry and refresh, sign-out clears tokens |
| Health data visible on a shared or lost device | Medium | High | OS lock screen; only today's schedule is cached locally; no health data in notification bodies beyond medication name and time **[product: consider an option to hide the name in notifications]** |
| Data exposed through the exported report | Medium | Medium | Export is user-initiated, goes to the OS share sheet only, and is not stored by Takt |
| Wrong adherence figure damaging trust or a clinical conversation | Low | Medium | Deterministic formula; edge cases (mid-day add, pause, time zone, DST, same-time doses) covered by fixtures in `npm run verify` |
| Consent unclear or bundled | Low | High | Dedicated screen, plain language, versioned record, one-step withdrawal |
| Processor breach | Low | High | Ovok EU hosting, tenant isolation, Art. 28 agreement **[legal]** |
| Relative sees more than intended (v1.1) | Medium | High | Permission scoped to today's doses and status; no diary, no report, no editing; revocation immediate and audited |

## 6. Rights of the data subject

Access, rectification and erasure are exercised in the app (edit or archive a medication, correct or remove a dose log, withdraw consent) or by request to the controller. Data portability is served by the CSV and PDF exports. **[legal: define the deletion process on the Ovok side and the response time.]**

## 7. Sign-off

| Role | Name | Date |
|---|---|---|
| Product owner | | |
| Data-protection officer | | |
| Engineering | | |
