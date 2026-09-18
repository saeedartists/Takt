# Takt Health — Publish Guide (for humans and LLM agents)

**Canonical project folder:** `/Users/saeed/Downloads/Projects/web/Takt`

Do **not** use `Takt-source`. That folder was a temporary Expo Go workspace. All work happens in **`Takt`** only. It has the full UI, `ios/` Xcode project, assets, and TestFlight history.

---

## Project identity

| Field | Value |
|---|---|
| App display name | **Takt Health** (App Store name "Takt" was taken) |
| Bundle ID | `com.actimi.takt` |
| Expo slug | `saeed` |
| Expo owner | `saeedartists1s-team` |
| EAS project ID | `d4b1c55c-cddf-4e3e-a188-25ebbe9388ba` |
| Apple team ID | `TR4973K4Q2` |
| GitHub remote | `saeedartists/Takt` |
| Current version | `0.1.1` (build `2`) — bump before each new upload |

---

## Three ways to share the app

| Method | Audience | Needs Apple Dev? | Data mode |
|---|---|---|---|
| **Expo Go + EAS Update** | Quick demo via QR | No | Sample data (mock) |
| **TestFlight (Xcode upload)** | iPhone testers | Yes ($99/yr) | Mock (testflight profile) |
| **TestFlight (EAS auto-build)** | iPhone testers | Yes + one-time EAS credentials | Mock (testflight profile) |

---

## 1. Expo Go demo (QR code share)

Use this when someone should try the app in **Expo Go** without TestFlight.

### Prerequisites

```bash
cd /Users/saeed/Downloads/Projects/web/Takt
npm install
eas login          # account: saeedartists1
eas whoami         # should show saeedartists1s-team
```

### Important: runtime version for Expo Go

`app.json` uses `"runtimeVersion": { "policy": "appVersion" }` for TestFlight OTA. **Expo Go requires SDK runtime.** Before publishing an Expo Go update, temporarily set:

```json
"runtimeVersion": { "policy": "sdkVersion" }
```

After publishing, **revert to `appVersion`** before building for TestFlight.

### Publish update

```bash
npx expo-doctor
npm run typecheck

# Publish to preview channel (iOS + Android together — iOS-only updates 404)
npm run update:preview
# equivalent: eas update --channel preview --platform all --environment preview --non-interactive
```

### Share QR / link

```
https://qr.expo.dev/eas-update?projectId=d4b1c55c-cddf-4e3e-a188-25ebbe9388ba&runtimeVersion=exposdk:57.0.0&channel=preview
```

Dashboard: https://expo.dev/accounts/saeedartists1s-team/projects/saeed/updates

### What testers do

1. Install **Expo Go** (SDK 57): [iPhone](https://apps.apple.com/app/expo-go/id982107779) · [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
2. Log into Expo Go (team member or shared account)
3. Scan the QR or open the link above
4. Accept consent → app loads with **"Sample data — not real patient records"** banner

### Demo data behavior

- No Ovok tenant needed — mock mode defaults on when `EXPO_PUBLIC_OVOK_TENANT_CODE` is unset
- Medication data lives **in phone memory only** (resets when Expo Go restarts)
- Small flags (consent, language) persist in AsyncStorage on device

### WhatsApp share template

```
Hey — I published the Takt Health demo on Expo Go.

1. Download Expo Go
   iPhone: https://apps.apple.com/app/expo-go/id982107779
   Android: https://play.google.com/store/apps/details?id=host.exp.exponent

2. Log in to Expo Go (team account)

3. Scan this QR:
   https://qr.expo.dev/eas-update?projectId=d4b1c55c-cddf-4e3e-a188-25ebbe9388ba&runtimeVersion=exposdk:57.0.0&channel=preview

Sample data only — not real patients. Force-close Expo Go if you see an old screen.
```

---

## 2. TestFlight via Xcode (manual, proven path)

Use when EAS credentials are not set up. This is the method that successfully uploaded v0.1.1 build 2.

### Prerequisites

- Xcode from Mac App Store (~15 GB)
- Apple Developer Program on the signing Apple ID
- CocoaPods: `sudo gem install cocoapods` (if `pod install` fails)

### Step 0 — Bump version (every upload)

Edit **both** files:

**`app.json`:**
```json
"version": "0.1.2",
"ios": { "buildNumber": "3" }
```

**`ios/Takt/Info.plist`:**
```xml
<key>CFBundleShortVersionString</key>
<string>0.1.2</string>
<key>CFBundleVersion</key>
<string>3</string>
```

### Step 1 — Sanity checks

```bash
cd /Users/saeed/Downloads/Projects/web/Takt
npm install
npx expo-doctor
npm run typecheck
```

### Step 2 — Archive

```bash
cd ios
pod install   # if Pods changed
xcodebuild -workspace Takt.xcworkspace \
  -scheme Takt \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath ../build/TaktHealth-v0.1.2.xcarchive \
  archive \
  DEVELOPMENT_TEAM=TR4973K4Q2 \
  CODE_SIGN_STYLE=Automatic
```

Or in Xcode: **Product → Archive** (select "Any iOS Device", scheme **Takt**).

### Step 3 — Upload to App Store Connect

**Option A — Xcode Organizer (easiest):**
1. Window → Organizer → Archives
2. Select archive → **Distribute App**
3. **App Store Connect** → Upload → Automatic signing → Upload

**Option B — Command line:**

`build/ExportOptions.plist` already exists:

```xml
<key>method</key><string>app-store</string>
<key>destination</key><string>upload</string>
<key>signingStyle</key><string>automatic</string>
<key>teamID</key><string>TR4973K4Q2</string>
```

```bash
cd ios
xcodebuild -exportArchive \
  -archivePath ../build/TaktHealth-v0.1.2.xcarchive \
  -exportOptionsPlist ../build/ExportOptions.plist \
  -exportPath ../build/export-v0.1.2 \
  -allowProvisioningUpdates
```

### Step 4 — App Store Connect (TestFlight)

1. Open https://appstoreconnect.apple.com
2. **My Apps → Takt Health → TestFlight**
3. Wait for build to finish **Processing** (10–30 min)
4. Build must show **Ready to Test** (green), NOT "Ready to Submit" (yellow)

If stuck on **Ready to Submit**:
- Open the build → fill **What to Test?** → Save
- TestFlight → **Test Information** (sidebar) → fill Beta App Description + Feedback Email → Save
- Answer **Export Compliance** if prompted (usually "No" — only HTTPS)

5. **Internal Testing → internal tester team-takt → Builds → +** → select new build
6. Tester (`saeedartists@gmail.com`) opens **TestFlight app** on iPhone → pull to refresh → Update

### App Store Connect checklist (first release)

- App name: **Takt Health** (not "Takt" — taken)
- Bundle ID: `com.actimi.takt`
- Export compliance: `ITSAppUsesNonExemptEncryption: false` (already in app.json)
- Privacy policy URL + support URL required before App Review
- Do **not** submit mock-data build for App Review (Apple guideline 2.1 / 4.2)

---

## 3. TestFlight via EAS (automatic build + submit)

Use once iOS credentials are configured in EAS. Enables fully non-interactive CI-style uploads.

### One-time credential setup

```bash
cd /Users/saeed/Downloads/Projects/web/Takt
eas credentials --platform ios
```

Follow prompts: Apple ID login, generate distribution certificate + provisioning profile. EAS stores them for reuse.

Optional — fill `eas.json` submit section to skip prompts:

```json
"submit": {
  "testflight": {
    "ios": {
      "appleId": "saeedartists@gmail.com",
      "ascAppId": "<from App Store Connect → App Information → Apple ID>",
      "appleTeamId": "TR4973K4Q2"
    }
  }
}
```

### Build and auto-submit

```bash
# Bump version in app.json + Info.plist first (see Step 0 above)

npm run build:testflight
# equivalent: eas build --platform ios --profile testflight --non-interactive

# If not using --auto-submit on build:
npm run submit:testflight
# equivalent: eas submit --platform ios --profile testflight --latest --non-interactive

# Or combined:
eas build --platform ios --profile testflight --auto-submit --non-interactive
```

The `testflight` profile in `eas.json`:
- `"distribution": "store"` (required for TestFlight — **not** `internal`)
- `"channel": "preview"`
- `"autoIncrement": true`
- `"EXPO_PUBLIC_OVOK_MOCK": "1"` (demo data for TestFlight)

Then complete App Store Connect steps from Section 2 Step 4.

---

## 4. Production App Store release (future)

When Ovok tenant credentials are ready:

1. Set production env in EAS:
   ```bash
   eas env:create --name EXPO_PUBLIC_OVOK_TENANT_CODE --value <tenant> --environment production
   eas env:create --name EXPO_PUBLIC_OVOK_CLIENT_ID --value <client-id> --environment production
   ```
2. `eas build --platform ios --profile production`
3. `eas submit --platform ios --profile production --latest`
4. Complete App Store Connect metadata (screenshots, privacy labels, review notes)

See also: `docs/TAKT_App_Store_Release_Runbook.md`

---

## Version bump checklist

Before every TestFlight / App Store upload:

| File | Fields |
|---|---|
| `app.json` | `expo.version`, `expo.ios.buildNumber`, `expo.android.versionCode` |
| `ios/Takt/Info.plist` | `CFBundleShortVersionString`, `CFBundleVersion` |

Keep both in sync. EAS `autoIncrement: true` can bump build numbers on cloud builds, but local Xcode archives use whatever is in the files.

---

## OTA updates (JS-only, no new binary)

For builds already on TestFlight with matching runtime version:

```bash
# TestFlight builds on preview channel
eas update --channel preview --message "Fix copy on Today screen"

# Production channel (after production build exists)
eas update --channel production --message "Hotfix"
```

Runtime policy is `appVersion` — updates only reach builds with the same `version` in `app.json`. Bump version and rebuild when native dependencies change.

---

## Environment variables reference

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_OVOK_MOCK` | `1` = force sample data; `0` = force live; unset = auto (mock if no tenant) |
| `EXPO_PUBLIC_OVOK_TENANT_CODE` | Ovok tenant — required for live backend |
| `EXPO_PUBLIC_OVOK_CLIENT_ID` | Ovok OAuth client ID |
| `EXPO_PUBLIC_OVOK_API_URL` | Default `https://api.ovok.com` |

Logic lives in `src/lib/env.ts`. Mock install in `src/lib/mock-server.ts`.

---

## Common errors and fixes

| Error | Fix |
|---|---|
| SDK 56 vs Expo Go 57 | Publish with `runtimeVersion=exposdk:57.0.0`; project is Expo SDK 57 |
| iOS update 404 | Publish **both** iOS and Android: `--platform all` |
| `RNPermissions` crash in Expo Go | Metro stubs in `metro.config.js` + `src/lib/web-native-stub.js` |
| "Backend setup required" on scan | Mock defaults when no tenant (`env.ts`); republish EAS Update |
| App Store name "Takt" taken | Use **Takt Health** everywhere |
| TestFlight "No Builds Available" | Build must be **Ready to Test**; fill What to Test; accept web invite |
| Build stuck "Ready to Submit" | Fill Test Information + What to Test on build page |
| Content under status bar | Fixed in v0.1.1 via `PageShell` safe-area insets |
| EAS build fails non-interactive | Run `eas credentials --platform ios` once interactively |
| `preview` profile ≠ TestFlight | `preview` is ad-hoc internal; use `testflight` profile for TestFlight |

---

## Key files map

| File | Role |
|---|---|
| `app.json` | Version, bundle ID, EAS project ID, updates URL, runtime policy |
| `eas.json` | Build profiles: development, preview, testflight, production |
| `ios/Takt.xcworkspace` | Xcode project for archive/upload |
| `ios/Takt/Info.plist` | Native version strings (must match app.json) |
| `build/ExportOptions.plist` | CLI export/upload settings |
| `metro.config.js` | Stubs native modules for Expo Go compatibility |
| `src/lib/env.ts` | Mock vs live backend decision |
| `src/lib/mock-server.ts` | In-memory FHIR demo data |
| `src/components/sample-data-banner.tsx` | "Sample data" safety banner |
| `src/components/ui/page.tsx` | Safe-area top inset for tab screens |
| `docs/TAKT_App_Store_Release_Runbook.md` | Detailed App Store checklist |

---

## LLM agent instructions

When asked to publish Takt:

1. **Confirm folder:** work only in `/Users/saeed/Downloads/Projects/web/Takt`
2. **Identify target:** Expo Go demo → Section 1; TestFlight → Section 2 or 3
3. **Bump version** if uploading a new binary (Section "Version bump checklist")
4. **Run sanity:** `npx expo-doctor && npm run typecheck`
5. **Execute** the appropriate section commands
6. **Report back:** version/build number, upload status, App Store Connect next steps for the user
7. **Never** commit `.env.local` or secrets
8. **Never** submit mock-data build for App Review

When asked to merge from `Takt-source`: do **not** overwrite Takt UI files. Only port infrastructure fixes (metro stubs, env mock default, sample banner, update scripts).
