import { polyfillMedplumWebAPIs } from '@medplum/expo-polyfills';
import { OvokProvider } from '@ovok/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { DEFAULT_COLORS, DEFAULT_MULTIPLIERS, OvokThemeProvider } from '@/lib/ovok-theme-provider';
import { SampleDataBanner } from '@/components/sample-data-banner';
import { installOvokMocks } from '@/lib/mock-server';
import { ovokClient } from '@/lib/ovok-client';
import { queryClient } from '@/lib/query-client';
import { LocaleProvider, useLocale } from '@/lib/takt/l10n';

polyfillMedplumWebAPIs();
installOvokMocks();

function AppStack() {
  const { t } = useLocale();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ title: t('setupTitle') }} />
      <Stack.Screen name="auth/sign-in" options={{ title: t('authSignInTitle') }} />
      <Stack.Screen name="auth/register" options={{ title: t('authRegisterTitle') }} />
      <Stack.Screen name="auth/reset-password" options={{ title: t('authResetPasswordTitle') }} />
      <Stack.Screen name="consent" options={{ title: t('consentRouteTitle') }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="medications/new" options={{ title: t('addMedicationRouteTitle') }} />
      <Stack.Screen name="medications/[id]" options={{ title: t('editMedicationRouteTitle') }} />
      <Stack.Screen name="report" options={{ title: t('reportRouteTitle') }} />
      <Stack.Screen name="settings/privacy" options={{ title: t('privacyRouteTitle') }} />
      <Stack.Screen name="settings/imprint" options={{ title: t('imprintRouteTitle') }} />
      <Stack.Screen name="settings/readiness" options={{ title: t('readinessRouteTitle') }} />
      <Stack.Screen name="settings/isolation" options={{ title: t('isolationRouteTitle') }} />
      <Stack.Screen name="settings/reminder-certification" options={{ title: t('reminderCertRouteTitle') }} />
      <Stack.Screen name="settings/session-security" options={{ title: t('sessionQaRouteTitle') }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <OvokProvider client={ovokClient}>
            <LocaleProvider>
              <OvokThemeProvider
                theme={{
                  colors: DEFAULT_COLORS,
                  dark: false,
                  spacingMultiplier: DEFAULT_MULTIPLIERS.spacing,
                  borderRadiusMultiplier: DEFAULT_MULTIPLIERS.borderRadius,
                }}
              >
                <StatusBar style="auto" />
                <SampleDataBanner />
                <AppStack />
              </OvokThemeProvider>
            </LocaleProvider>
          </OvokProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
