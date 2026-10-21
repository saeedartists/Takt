# Takt access policies

These files are starting points for the Ovok tenant. Validate every `criteria` against the
tenant's Medplum/Ovok version before assigning them to real users.

- `patient.json` is the policy for a signed-in patient. It scopes every resource to `%profile`.
- `family-share-relative.template.json` is a read-only template. The family-share bot must
  create a per-relative policy with `%patient` resolved to the patient whose today view is
  being shared, and `%relative` scoped to the invited `RelatedPerson`. Do not assign the
  template with unresolved placeholders. It intentionally omits `MedicationAdministration`
  and `Consent`: the relative bot returns only the approved today view, and the relative
  must not be able to query the patient's full dose diary or other family-share consents
  directly.
- The bot/server identity uses a separate client-credentials identity with access to the
  resources it reconciles. Never reuse the mobile app client secret for bots.

`Medication` has no `patient` field in the current Takt contract, so access is scoped by the
`https://actimi.com/fhir/takt/patient-scope` identifier. The app adds that identifier when
creating or updating a `Medication`. Before enabling this policy on an existing tenant, run
`npm run bot:backfill-meds -- --dry-run` and then `npm run bot:backfill-meds -- --confirm`
from `server/` to backfill legacy records; unresolved conflicts are reported and never
overwritten.

`RelatedPerson` currently holds the relative's email and the optional linked relative account.
Do not expose `RelatedPerson` records to the relative unless the tenant has been checked for
telecom search behavior and PII exposure.
