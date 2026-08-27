# Takt — Builder Output Shape Decision (Release Gate)

Date: 2026-08-27
Owner: Builder execution trace

## Question
Does Ovok Builder emit a deployable mobile bundle (`.app/.apk/.aab`) or only a hosted preview page?

## Evidence
1. **Builder preview is hosted URL**
   - Mobile preview starts through Expo dev server and returns a sandbox URL.
   - Current verified preview endpoint: `https://sb-5q51kehmn939.vercel.run`.

2. **Deployable bundle path requires EAS credentials**
   - Attempted `deploy_to_eas(target: all, submit: false)`.
   - Result: `ok: false`, `reason: eas-not-configured`, `EAS_TOKEN unset`.

3. **No direct one-click `.app/.apk` artifact emitted by Builder preview flow**
   - Builder provides hosted preview + source tree.
   - Store-grade binary generation is delegated to EAS build pipeline.

## Decision
**Builder emits ONLY HOSTED PAGE in current environment** (no deployable bundle artifact available from this chat runtime today).

## Go / No-Go Recommendation
- **NO-GO** for release gating that depends on immediate native bundle output from Builder alone.
- **GO** only if EAS credentials are enabled and a native build pipeline is executed/verified.

## Impact on architecture
- If EAS remains unavailable, release plan must assume:
  - hosted/mobile-web preview for validation, and
  - a separate native shell/build lane for production app binaries.
- Offline/background reminder certification cannot be signed off from hosted preview alone.

## Required next step
1. Enable EAS credentials for this workspace.
2. Run native build for iOS and Android.
3. Execute overnight local-notification test with app closed on physical devices.
