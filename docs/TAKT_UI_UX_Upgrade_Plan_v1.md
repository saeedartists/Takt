# Takt UI/UX Upgrade Plan v1

Date: 2026-09-17. Based on a full code read plus a headless web walkthrough (consent → add medication → Today → detail → History → Settings, light/dark, EN/DE, 430px and 1440px).

Goal: make the existing calm design system feel finished. Keep the tokens, cards, and palettes that exist. Fix hierarchy, add a real loading/motion system, and remove the things that make it look like a prototype.

---

## 0. What holds it back today (evidence)

| Area | Observed | Where |
|---|---|---|
| Hierarchy | On Today the first dose row is below the fold. Week strip + onboarding card + hero card come first. The core action is last. | `app/(tabs)/today.tsx` |
| Motion | Infinite pulse on the due-now badge and celebration glow. Violates the project's own Calm UX rule B.13. No reduce-motion handling anywhere. | `greeting-hero-card.tsx:44-59`, `celebration-card.tsx:29-38` |
| Loading | Every screen shows a bare spinner (`LoadingState`). No skeletons, no pending state on buttons, no optimistic dose updates (checkmark waits for the network round-trip). | `states.tsx`, `use-takt-mutations.ts` |
| Typography | DM Sans is installed (`@expo-google-fonts/dm-sans`) but never loaded. App renders in the system font. | `tokens.ts:195-208`, `app/_layout.tsx` |
| Web layout | No max-width. At 1440px cards and the tab bar stretch edge to edge. Browser-default blue focus ring on inputs. | `page.tsx:13-23` |
| Forms | Times are a free-text comma list. "Last refilled" is a `YYYY-MM-DD` text box. Form field has both an input and chips. Single error string at the bottom. New and Edit are ~150 duplicated lines. | `medications/new.tsx`, `medications/[id]/edit.tsx` |
| Detail screen | Medication name shown three times. Four stacked full-width gray buttons. Refill hard-coded to +30. | `medications/[id].tsx` |
| Settings | 9 internal QA boards (release hub, isolation matrix, session QA…) sit in the patient-facing list under polished headers. Palette names untranslated in DE. Sample banner is not theme-aware in dark mode. | `app/(tabs)/settings.tsx:196-277` |
| Accessibility | Dose row actions, week strip days, form chips have no labels. `hapticFeedback` prop is a no-op. | `animated-dose-row.tsx`, `week-strip-picker.tsx`, `animated-pressable.tsx:17` |
| i18n | Consent trust-pillar copy hard-coded in English. | `app/consent.tsx:55-70` |
| Web crash | Notification hooks threw on web (fixed 2026-09-17 with a `Platform.OS === 'web'` guard in `reminders.ts`). | `reminders.ts` |

---

## 1. Foundations (do first, everything else builds on it)

### 1.1 Motion tokens + reduce motion
- Add to `src/theme/tokens.ts`:
  - `motion.spring.gentle = { damping: 20, stiffness: 180 }` (layout, progress)
  - `motion.spring.snappy = { damping: 18, stiffness: 350 }` (press, checkmark)
  - `motion.duration = { fast: 150, base: 220, slow: 320 }`
  - `motion.stagger = 40` (ms per list item, cap 8 items)
- Use `useReducedMotion()` from `react-native-reanimated` in one hook `useMotion()` that returns tokens or zero-duration equivalents. Every decorative animation reads from it.
- Delete both infinite `withRepeat` pulses. Replace with a one-shot spring-in on mount (scale 0.92 → 1) and a static soft ring.

### 1.2 Typography
- Load DM Sans (400/500/600/700) with `useFonts` in `app/_layout.tsx`, hold the splash with `SplashScreen.preventAutoHideAsync()` until fonts and theme hydration resolve (theme-context already tracks `hydrated` but never exposes it; expose it).
- Set `fontFamily` per weight in the `typography` ramp. Use `fontVariant: ['tabular-nums']` on all metrics (hero count, adherence %, supply count, times).

### 1.3 Responsive shell
- `PageShell`: content container `maxWidth: 680, width: '100%', alignSelf: 'center'`. Forms use 560.
- Tab bar: same max-width, centered, with a hairline top border instead of a full-width raised bar on wide screens.
- Inputs on web: `outlineStyle: 'none'` and an accent border on focus (state-driven), so the focus ring matches the palette.

### 1.4 Loading system
- New `Skeleton` primitive (`src/components/ui/skeleton.tsx`): rounded block, opacity 0.45 ↔ 0.8 over 1.2s with `withRepeat`; static at 0.6 under reduce motion. Variants: `line`, `circle`, `card`.
- `Button` gets `loading` prop: label fades to 0, `ActivityIndicator` fades in, width preserved, pressable disabled. Use it on every mutation button (Save, Confirm taken, Export, Withdraw consent, Sign in).
- Per-screen skeleton layouts (listed per screen below) replace `LoadingState` for the first load. `LoadingState` stays for refetch-in-place cases only.

### 1.5 Optimistic dose updates
- `useRecordDose` / `useUndoDose`: add `onMutate` that patches the `['takt','MedicationAdministration', patientRef]` cache, `onError` rollback, `onSettled` invalidate. The checkmark and row state change instantly; the undo toast appears at the same time.

### 1.6 Toast
- Generalise `FloatingUndoToast` into a small `useToast()` (success / info / undo). Same enter/exit (`FadeInDown` / `FadeOutDown` with the gentle spring). Used for: dose taken (with Undo), medication saved, refill logged, CSV/PDF exported, settings changes.

### 1.7 Haptics (native only)
- Add `expo-haptics` and implement the existing `hapticFeedback` prop: `Light` on press, `Success` on Take, `Warning` on Skip, `Rigid` on destructive confirm. Gate to native.

### 1.8 Cleanup that changes the perceived quality
- Move the 9 QA boards into a "Developer" section rendered only when `__DEV__ || env.ovokMockEnabled`. Keep Privacy, Imprint, Family sharing in the user list.
- Make `SampleDataBanner` read theme tokens (dark mode currently shows a cream bar).
- Move consent trust-pillar copy and palette names/descriptions into `locales/en.ts` and `de.ts`.
- Remove unused deps and components: `@gorhom/bottom-sheet`, `@shopify/flash-list`, `iconsax-react-nativejs`, `lottie-react-native`, `react-native-pdf`, `i18next`, `react-native-i18next`, `@react-native-community/netinfo`, `MetricTile`, `SettingsList`, `SettingsRow`, `src/locales/*.json`, plain `app/auth/*.tsx` fallbacks, `src/screens/root-layout.*`.

---

## 2. Screen by screen

### 2.1 Today (the product)
Flow / hierarchy
- New order: compact header (title, date, Report link) → **Next dose card** → timeline → week strip (moved to a slim row under the header, selected day pill slides with a spring) → hero stats (moved to bottom of the header block as one line: `2 of 4 taken · 1 due`).
- Next dose card: medication, strength, time, and one primary "Take" button when due. When nothing is due: "Next dose at 18:00 · Metformin" (static text, no countdown, per Calm UX).
- Onboarding journey card only when there are 0 plans. Step 2 ("log first dose") becomes a one-line hint in the next-dose card instead of a full card.
- Remove the duplicated date line in the hero.
- Snooze: replace the modal with an inline expander inside the row (`LinearTransition`), four chips 5/10/15/30, preselecting the settings default.
- Auto-marked missed doses: quiet inline notice "1 dose was marked missed at 12:00. Fix in History." with a link.
- Tab badge: due-now count on the Today tab icon.

Animations
- Rows enter with `FadeInDown.delay(i * 40)` (cap 8) on first load only.
- Filter change: rows `LinearTransition` between groups; content of the segmented control crossfades 150ms.
- Take: checkmark spring-in with overshoot (exists) + row background tints to `success` at 10% over 220ms + title gets a subtle strike. Skip: row opacity to 0.6. Undo: reverse.
- Progress: replace the flat bar with a 56px SVG ring (react-native-svg is installed) whose `strokeDashoffset` springs to the new value.
- Week strip: selected pill slides (measured x + `withSpring`) instead of re-rendering.

States
- Loading: skeleton next-dose card + 3 skeleton rows.
- Empty (no plans): existing empty state, primary "Add medication".
- Empty (all done): `CelebrationCard` without the pulse.
- Error: `ErrorState` with Retry (exists).
- A11y: every action gets `accessibilityLabel` = "Confirm taken, Ramipril, 08:00"; week-strip days get labels and `selected` state.

### 2.2 Medications list
- Rows: leading form icon tinted by status, second line `Daily · 08:00, 20:00 · 5 mg`, third line `Next today 20:00` (from schedule data) or `Low supply · 5 left` chip in `warning`.
- Search input gets a clear (×) button; status filter and search animate the list with `LinearTransition`.
- Stagger rows on first load. Skeleton: 4 rows.
- Empty: keep copy, make "Add medication" primary.

### 2.3 Medication detail
- Header title = medication name; drop the large duplicate page title. Hero card: icon, name, form · strength, status and cadence badges, time chips, and a single primary "Edit plan".
- Replace the four stacked gray buttons with a 2×2 action grid (Pause/Resume, Refill, Timeline, Archive). Archive is `destructive` tone and opens a small inline `ConfirmSheet` (expanding card, two buttons) instead of `Alert.alert`, which is a no-op on web.
- Refill: tappable amount (28 / 30 / 60 / 90 / custom) instead of hard `+30`. Supply bar turns `warning` under 7 and `destructive` at 0; springs to the new value.
- Recent dose logs: vertical timeline with state dots (taken/skipped/missed), grouped by day.
- Skeleton: hero + supply card. Pending state on Pause/Archive/Refill.

### 2.4 Add / Edit medication (one shared form)
- Extract `MedicationForm` (`src/components/takt/medication-form.tsx`) used by both `new.tsx` and `[id]/edit.tsx`. Edit passes `initialValues` and the extra Status + Last refilled fields.
- Form field: chips only (Tablet, Capsule, Drops, Inhaler, Syrup, Other → reveals text input). Remove the redundant input.
- Times: chip list of selected times (sorted, each removable with ×). Preset chips toggle. "+ Add time" opens `@react-native-community/datetimepicker` (installed, unused) in time mode; on web it renders a native `<input type="time">`.
- Last refilled: same picker in date mode.
- Validation: per-field, on blur, error text fades in under the field. Save is disabled until the form is valid.
- Sticky Save bar at the bottom using `KeyboardStickyView` from react-native-keyboard-controller (installed, unused) with `loading` state.
- Cadence → weekday picker expands with `LinearTransition`. Sections fade in with a 60ms stagger.
- After save: navigate back and toast "Ramipril added · first dose at 18:00".

### 2.5 History
- Trend card: adherence % animates with `withTiming` on window change; bars per day instead of a sparkline (tappable later), today marked; path/bars draw in over 320ms on first load.
- Correction list grouped by day with a sticky day label. Each row's segmented control animates the state change and shows a pending indicator while the mutation runs.
- Export CSV: `loading` on the button, toast on success, clear "Sharing not available on web, file downloaded" message.
- Skeleton: trend card + 3 rows.

### 2.6 Doctor report
- On-screen preview styled as a paper sheet (white card, subtle shadow, patient header, date, adherence ring) so it mirrors the PDF.
- "Export PDF": `loading` state "Preparing PDF…". On web, `Sharing.isAvailableAsync()` is false, so fall back to `Print.printAsync({ html })` (opens the browser print/save dialog) and say so.
- Section rows stagger in.

### 2.7 Consent and first run
- Move all copy to i18n. Cards stagger in (FadeInDown, 60ms). CTA sticky at the bottom with safe-area padding and `loading` while the Consent resource and patient are created.
- Keep the "Step 1 of 2 / Step 2 of 2" journey but animate the step change (card content crossfade, badge pill springs).

### 2.8 Settings
- Sections: Appearance, Language, Reminders, Notifications (new row: permission status + "Open system settings", using the existing `Linking` helper), Care (Family sharing), Legal (Privacy, Imprint), Account (Sign out with confirm), Developer (only in dev/mock).
- Theme change: 250ms crossfade of background and surface colors in `ThemedAppContainer` so the switch does not flash.
- Palette rows: swatch scales in on selection, checkmark springs in; names and descriptions translated.
- Footer: app version + build (from `expo-constants`).

### 2.9 Auth (live mode)
- Same shell as the rest: DM Sans, accent focus border, inline field errors, `loading` button, password visibility toggle, "Forgot password" link, error banner fades in. Same max-width on web.

---

## 3. Micro-interaction catalogue (small, consistent, reused)

| Interaction | Spec |
|---|---|
| Press | scale 0.97, opacity 0.9, snappy spring; light haptic (native) |
| Take | checkmark scale 0 → 1.15 → 1 (snappy), row tint to success 10%, success haptic, toast with Undo |
| Skip | row opacity → 0.6 over 220ms, warning haptic |
| Undo | reverse of Take, toast dismisses |
| Segmented control | indicator pill springs (exists) + content crossfade 150ms |
| List enter | FadeInDown, 40ms stagger, max 8 rows, first load only |
| List reorder / filter | LinearTransition on rows |
| Progress ring / bar | gentle spring to value |
| Expanders (snooze, weekday picker, confirm sheet) | LinearTransition, content FadeIn 150ms |
| Toast | FadeInDown / FadeOutDown, gentle spring, 8s undo window bar |
| Theme switch | 250ms color crossfade |
| Skeleton | opacity 0.45 ↔ 0.8, 1.2s, static under reduce motion |
| Tab icon | scale 1 → 1.08 on focus, snappy spring |

All of these read `useMotion()`; under reduce motion durations become 0 and staggers are removed.

---

## 4. Order of work

| Phase | Scope | Touches |
|---|---|---|
| P0 Foundations | 1.1 – 1.8 | tokens, theme-context, _layout, page, controls, states, skeleton, toast, mutations, settings, banner, locales |
| P1 Today | 2.1 | today.tsx, animated-dose-row, greeting-hero-card, celebration-card, week-strip-picker, tabs layout |
| P2 Forms + detail | 2.3, 2.4 | medication-form (new), new.tsx, [id]/edit.tsx, [id].tsx, confirm-sheet (new) |
| P3 Lists, History, Report | 2.2, 2.5, 2.6 | medications.tsx, history.tsx, report.tsx, sparkline |
| P4 Settings, consent, auth | 2.7, 2.8, 2.9 | settings.tsx, consent.tsx, screens/auth/* |

Each phase ends with: `npx tsc --noEmit`, the headless web walkthrough (consent → add → take → detail → history → settings), light and dark, EN and DE, 430px and 1440px, and a reduce-motion pass.

---

## 5. Deliberate ceilings

- No side-rail navigation on desktop in v1. Centered content is enough for the demo.
- No skeleton-per-row for the correction list beyond 3 placeholders.
- Count-up numbers only where already animated (adherence %, hero count). Not on every metric.
- Bottom sheets stay inline expanders. `@gorhom/bottom-sheet` is removed rather than made web-safe.
