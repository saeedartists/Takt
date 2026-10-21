import { OvokProvider } from '@ovok/core';
import { QueryClientProvider , focusManager } from '@tanstack/react-query';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { installOvokMocks } from '@/lib/mock-server';
import { ovokClient } from '@/lib/ovok-client';
import { queryClient } from '@/lib/query-client';
import { env } from '@/lib/env';
import { captureError } from '@/lib/takt/error-reporting';
import { LocaleProvider, useLocale } from '@/lib/takt/l10n';
import { StackHeader } from '@/components/ui/stack-header';
import {
  AppErrorBoundary,
  ThemedCrashFallback,
} from '@/components/takt/error-boundary';
import { ThemeProvider, useTheme } from '@/theme/theme-context';

installOvokMocks();
// Safety net for a store binary: the mock server must never ride along with a
// production build. Loud in the logs and in the error sink if it somehow does.
if (!__DEV__ && env.ovokMockEnabled) {
  console.error('[Takt] The Ovok mock server is enabled in a production build — check EXPO_PUBLIC_TAKT_MOCK / EXPO_PUBLIC_OVOK_TENANT_CODE.');
  captureError(
    'global',
    new Error('mock-server enabled in a production build (EXPO_PUBLIC_TAKT_MOCK / EXPO_PUBLIC_OVOK_TENANT_CODE misconfiguration)'),
  );
}
// Hold the splash until the brand faces are in, so no screen flashes system type.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppStack() {
  const { t } = useLocale();
  const { c } = useTheme();

  return (
    <Stack
      screenOptions={{
        header: (props) => <StackHeader {...props} />,
        contentStyle: { backgroundColor: c.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ title: t('setupTitle') }} />
      <Stack.Screen name="backend-down" options={{ headerShown: false }} />
      <Stack.Screen name="auth/sign-in" options={{ title: t('authSignInTitle') }} />
      <Stack.Screen name="auth/register" options={{ title: t('authRegisterTitle') }} />
      <Stack.Screen name="auth/reset-password" options={{ title: t('authResetPasswordTitle') }} />
      <Stack.Screen name="auth/reset-complete" options={{ title: t('authCompleteRouteTitle') }} />
      <Stack.Screen name="consent" options={{ title: t('consentRouteTitle') }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="medications/new" options={{ title: t('addMedicationRouteTitle'), animation: 'slide_from_bottom' }} />
      <Stack.Screen name="medications/[id]" options={{ title: t('medicationDetailsRouteTitle') }} />
      <Stack.Screen name="medications/[id]/edit" options={{ title: t('editMedicationRouteTitle') }} />
      <Stack.Screen name="report" options={{ title: t('reportRouteTitle') }} />
      <Stack.Screen name="diary" options={{ title: t('diaryRouteTitle') }} />
      <Stack.Screen name="week" options={{ title: t('weekRouteTitle') }} />
      <Stack.Screen name="tour" options={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="refills" options={{ title: t('refillsRouteTitle') }} />
      <Stack.Screen name="care/index" options={{ title: t('careRouteTitle') }} />
      <Stack.Screen name="care/contact" options={{ title: t('careContactRouteTitle'), animation: 'slide_from_bottom' }} />
      <Stack.Screen name="care/appointment" options={{ title: t('careAppointmentRouteTitle'), animation: 'slide_from_bottom' }} />
      <Stack.Screen name="settings/privacy" options={{ title: t('privacyRouteTitle') }} />
      <Stack.Screen name="settings/imprint" options={{ title: t('imprintRouteTitle') }} />
      <Stack.Screen name="settings/reminders" options={{ title: t('reminders') }} />
      <Stack.Screen name="settings/appearance" options={{ title: t('appearance') }} />
      <Stack.Screen name="settings/consent" options={{ title: t('consentRouteTitle') }} />
      <Stack.Screen name="settings/release-hub" options={{ title: t('releaseHubRouteTitle') }} />
      <Stack.Screen name="settings/readiness" options={{ title: t('readinessRouteTitle') }} />
      <Stack.Screen name="settings/isolation" options={{ title: t('isolationRouteTitle') }} />
      <Stack.Screen name="settings/reminder-certification" options={{ title: t('reminderCertRouteTitle') }} />
      <Stack.Screen name="settings/session-security" options={{ title: t('sessionQaRouteTitle') }} />
      <Stack.Screen name="settings/report-review" options={{ title: t('reportReviewRouteTitle') }} />
      <Stack.Screen name="settings/accessibility-pass" options={{ title: t('a11yPassRouteTitle') }} />
      <Stack.Screen name="settings/consent-audit" options={{ title: t('consentAuditRouteTitle') }} />
      <Stack.Screen name="settings/family-sharing" options={{ title: t('familySharingRouteTitle') }} />
      <Stack.Screen name="settings/relative-view" options={{ title: t('familySharingRelativeRouteTitle') }} />
    </Stack>
  );
}

function ThemedAppContainer() {
  const { isDark, c } = useTheme();
  // React Query's focusManager is window-aware on web out of the box, but on
  // native nothing maps backgrounding to "focus" — without this, a query only
  // refetches on remount. Refetch on app foreground so data from another
  // device (same account) appears as soon as you come back.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  // Crossfade the app background on scheme change so a theme switch does not flash.
  const background = useSharedValue(c.background);
  useEffect(() => {
    background.value = withTiming(c.background, { duration: 250 });
  }, [background, c.background]);

  // Web-only: antialiased system type + an overscroll background that matches
  // the app surface (the native side ignores this).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const existing = document.getElementById('takt-web-chrome');
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = 'takt-web-chrome';
    style.textContent = [
      `html, body { background: ${c.background}; }`,
      `@media (prefers-color-scheme: dark) { html, body { background: #0F1115; } }`,
      `body, div, span, p, h1, h2, h3, input, textarea, button, label { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }`,
    ].join('\n');
    document.head.appendChild(style);
  }, [c.background]);
  const crossfade = useAnimatedStyle(() => ({ backgroundColor: background.value }));

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Animated.View style={[{ flex: 1 }, crossfade]}>
        <AppStack />
      </Animated.View>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  // A font failure falls back to system type rather than blocking the app.
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Outer net: no provider deps, catches failures in theming/i18n setup. */}
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <OvokProvider client={ovokClient}>
              <ThemeProvider>
                <LocaleProvider>
                  {/* Inner net: themed, localized crash screen. */}
                  <AppErrorBoundary fallbackRender={(retry) => <ThemedCrashFallback onRetry={retry} />}>
                    <ThemedAppContainer />
                  </AppErrorBoundary>
                </LocaleProvider>
              </ThemeProvider>
            </OvokProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}
