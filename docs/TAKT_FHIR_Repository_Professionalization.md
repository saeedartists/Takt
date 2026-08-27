# Takt — FHIR Repository Professionalization

## What was added
- `src/lib/takt/fhir-repository.ts`
  - Typed resource access for Patient, Medication, MedicationRequest, MedicationAdministration, Consent, RelatedPerson
  - Retry on transient API failures (429/5xx)
  - OperationOutcome extraction into readable errors

- `src/lib/takt/fhir-validation.ts`
  - Resource validators for:
    - Patient
    - Medication
    - MedicationRequest
    - MedicationAdministration
    - Consent
    - RelatedPerson
  - Graph integrity validator:
    - MedicationRequest must link to Patient + Medication
    - MedicationAdministration must link to Patient + MedicationRequest + Medication

## Query hooks added
- `useActiveMedicationPlans`
- `useTodayScheduleEvents`
- `useRecentAdministrations` (14-day default)
- `useConsentStatus`

## Hook migration
Core read hooks now use repository access instead of direct low-level fetch calls:
- `usePrimaryPatient`
- `useMedicationPlans`
- `useDoseEvents`
- `useConsentEvents`

## Integrity test runner
- `scripts/verify-fhir-integrity.ts`

Run:

```bash
pnpm dlx tsx scripts/verify-fhir-integrity.ts
```
