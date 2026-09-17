# Takt App Store Release Runbook

Date: 2026-09-17. State of this machine: no Xcode installed (Command Line Tools only), no CocoaPods, EAS CLI 23 logged in as `saeedartists1`. `npx expo-doctor` passes 21/21. `npx expo prebuild --platform ios --no-install` generates a valid Xcode project from `app.json`.

## Two ways to ship

| | EAS cloud build (recommended) | Local Xcode |
|---|---|---|
| Needs Xcode locally | No | Yes (App Store download, ~15 GB, plus CocoaPods) |
| Signing | EAS manages certificates and provisioning profiles for you | Manual or automatic in Xcode |
| Upload to App Store Connect | `eas submit` | Xcode Organizer or Transporter |
| Simulator testing | `eas build --profile preview --platform ios` with `simulator: true` | `npx expo run:ios` |

Everything below assumes the EAS path. Local Xcode is only needed if you want to run on a simulator or debug native code.

## Prerequisites (one time)

1. **Apple Developer Program** membership on the Apple ID that will own the app ($99/year). EAS cannot create this for you.
2. **App Store Connect app record**: App Store Connect → My Apps → + → iOS app, bundle ID `com.actimi.takt`, name "Takt", primary language, SKU. `eas submit` can also create it on the first run if the Apple ID has the Account Holder or Admin role.
3. **Backend**: a production build runs with `EXPO_PUBLIC_OVOK_MOCK=0`. Fill `EXPO_PUBLIC_OVOK_TENANT_CODE` and `EXPO_PUBLIC_OVOK_CLIENT_ID` in `eas.json` → `build.production.env` (or store them as EAS secrets with `eas env:create`). Until the Ovok tenant's patient login is unblocked (see `docs/TAKT_Auth_Blocker_Investigation.md`), a production build cannot sign users in. Ship TestFlight builds from the `preview` profile (mock mode on) in the meantime, but do not submit a mock-data build for App Review: Apple rejects demo-only apps under guideline 2.1 and 4.2.
4. **Legal copy**: `app/settings/imprint.tsx` and `app/settings/privacy.tsx` still hold placeholder legal-entity details. App Review reads them.

## Build and submit

```bash
# 0. sanity
npx expo-doctor
npx tsc --noEmit

# 1. internal test build (mock mode on, installable via link / TestFlight)
eas build --platform ios --profile preview

# 2. production build (real backend env from eas.json; build number auto-increments)
eas build --platform ios --profile production

# 3. upload the latest production build to App Store Connect / TestFlight
eas submit --platform ios --profile production --latest
```

`eas build` will ask, on the first run, to log in with the Apple ID and to generate the distribution certificate and provisioning profile. Say yes; they are stored in EAS. Re-use later with `eas credentials`.

`eas submit` will ask for the Apple ID, the App Store Connect app ID and the team ID on the first run. Put them into `eas.json` afterwards to skip the prompts:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "you@example.com",
      "ascAppId": "1234567890",
      "appleTeamId": "ABCDE12345"
    }
  }
}
```

## App Store Connect checklist

- **Screenshots**: 6.7" (1290×2796) and 6.5" (1284×2778) iPhone sets are required; iPad 12.9" (2048×2732) because `supportsTablet` is true (set it to false in `app.json` to skip iPad). Capture from a preview build or the web build at those sizes.
- **App Privacy** (nutrition labels): the app stores medication schedules and dose logs (Health & Fitness data), linked to the user. Declare "Health" data, collected, linked to identity, used for App Functionality. No tracking.
- **Export compliance**: already answered in `app.json` (`ITSAppUsesNonExemptEncryption: false`), so no prompt per build.
- **Age rating**: 4+ with the "Medical/Treatment Information" question answered Yes (infrequent).
- **Review notes**: explain that it is a medication reminder for patients of a clinic on the Ovok/Actimi platform, provide a test patient login, and mention that notifications need permission.
- **Support URL and Privacy Policy URL**: required fields; the privacy text in the app is not enough.
- **Health disclaimer**: keep "Takt is not a medical device" visible (it is on the consent screen and in Settings).

## After the first release

- OTA updates for JS-only changes: `eas update --channel production --message "…"`. The runtime version policy is `appVersion`, so an update only reaches builds with the same `version` in `app.json`. Bump `version` and rebuild when native dependencies change.
- Bump `expo.version` in `app.json` for each App Store release; `buildNumber` increments automatically (`autoIncrement: true`).

## Android (when needed)

```bash
eas build --platform android --profile production   # .aab
eas submit --platform android --profile production --latest
```

Needs a Google Play Console account, a service-account JSON for `eas submit`, and the same privacy declarations (Data safety form).
