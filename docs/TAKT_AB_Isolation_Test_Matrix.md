# Takt — Patient A/B Isolation Test Matrix (Execution Template)

Purpose: prove one patient cannot read or modify another patient’s data on live Ovok backend.

## Preconditions
- Two real patient accounts exist: Patient A and Patient B.
- Both can sign in to the same tenant.
- At least one medication plan and one dose event created by each patient.

## Test cases

1. **A reads A (allowed)**
   - Sign in as A.
   - Open Today, Medications, History.
   - Expected: only A resources visible.

2. **A reads B (denied)**
   - While signed in as A, attempt to fetch B resources by id/reference.
   - Expected: no B resources returned (403/404/empty as policy defines).

3. **A writes into B graph (denied)**
   - While signed in as A, attempt to create `MedicationAdministration` with `subject=Patient/B`.
   - Expected: write rejected.

4. **B reads B (allowed)**
   - Sign in as B and repeat baseline.
   - Expected: only B resources visible.

5. **B reads A (denied)**
   - Attempt cross-read from B into A.
   - Expected: denied.

6. **B writes into A graph (denied)**
   - Attempt cross-write from B into A.
   - Expected: rejected.

## Evidence capture (required)
- Screenshot per case (success/failure state).
- Request/response snippet with patient ref and status code.
- Final verdict per case: PASS / FAIL.
- If FAIL: remediation owner + due date.

## Exit criteria
- All 6 cases PASS.
- Evidence package stored with timestamp and tester name.
