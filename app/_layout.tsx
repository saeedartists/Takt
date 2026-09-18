import { polyfillMedplumWebAPIs } from '@medplum/expo-polyfills';
import { OvokProvider } from '@ovok/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { installOvokMocks } from '@/lib/mock-server';
import { ovokClient } from '@/lib/ovok-client';
import { queryClient } from '@/lib/query-client';
import { LocaleProvider, useLocale } from '@/lib/takt/l10n';

import { ThemeProvider, useTheme } from '@/theme/theme-context';

polyfillMedplumWebAPIs();
installOvokMocks();

function AppStack() {
  const { t } = useLocale();
  const { c } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.accent,
        headerTitleStyle: { color: c.textPrimary, fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ title: t('setupTitle') }} />
      <Stack.Screen name="auth/sign-in" options={{ title: t('authSignInTitle') }} />
      <Stack.Screen name="auth/register" options={{ title: t('authRegisterTitle') }} />
      <Stack.Screen name="auth/reset-password" options={{ title: t('authResetPasswordTitle') }} />
      <Stack.Screen name="consent" options={{ title: t('consentRouteTitle') }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="medications/new" options={{ title: t('addMedicationRouteTitle') }} />
      <Stack.Screen name="medications/[id]" options={{ title: t('medicationDetailsRouteTitle') }} />
      <Stack.Screen name="medications/[id]/edit" options={{ title: t('editMedicationRouteTitle') }} />
      <Stack.Screen name="report" options={{ title: t('reportRouteTitle') }} />
      <Stack.Screen name="settings/privacy" options={{ title: t('privacyRouteTitle') }} />
      <Stack.Screen name="settings/imprint" options={{ title: t('imprintRouteTitle') }} />
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
      `@media (prefers-color-scheme: dark) { html, body { background: #0B0F15; } }`,
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <OvokProvider client={ovokClient}>
            <ThemeProvider>
              <LocaleProvider>
                <ThemedAppContainer />
              </LocaleProvider>
            </ThemeProvider>
          </OvokProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
