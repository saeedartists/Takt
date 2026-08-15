import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { polyfillMedplumWebAPIs } from '@medplum/expo-polyfills';
import { OvokProvider } from '@ovok/core';
import {
  BottomSheetModalProvider as BSMPVOVK,
  DEFAULT_COLORS,
  DEFAULT_MULTIPLIERS,
  ThemeProvider as OvokThemeProvider,
} from '@ovok/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SampleDataBanner } from '@/components/sample-data-banner';
import { installOvokMocks } from '@/lib/mock-server';
import { ovokClient } from '@/lib/ovok-client';
import { queryClient } from '@/lib/query-client';

polyfillMedplumWebAPIs();

/*
 * Install the demo-data fetch interceptor at MODULE scope, not in an
 * effect. React Query fires `queryFn` while a screen is mounting —
 * before a provider effect would run — so an effect-based install
 * loses the race on first paint and the first list renders empty.
 * No-ops unless EXPO_PUBLIC_OVOK_MOCK is set.
 */
installOvokMocks();

/*
 * Provider chain — order matters. Follows the @ovok/native install
 * guide: Keyboard > Ovok > OvokTheme > BottomSheetModal > BSMPVOVK
 * > Stack. GestureHandlerRootView + QueryClientProvider wrap the
 * whole thing.
 */
export default function RootLayout() {
  const systemColorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <OvokProvider client={ovokClient}>
            {/*
             * Theme config. Two things here are load-bearing:
             *
             * 1. `colors` must satisfy
             *    `Partial<MD3Theme['colors']> & typeof DEFAULT_COLORS`
             *    (@ovok/native theme-provider-props.ts). An empty
             *    object does NOT satisfy it — the scaffold did not
             *    typecheck. Spread the SDK's own palette; override
             *    individual keys below it to rebrand.
             *
             * 2. The multipliers are the SDK's spacing scale, not a
             *    scale factor on top of it. `generate-theme.ts` defines
             *    `spacing: (v) => v * spacingMultiplier`, so every
             *    SDK component calling `theme.spacing(4)` expects
             *    4 * 4 = 16px. Passing 1 renders the entire component
             *    library at a quarter of its intended spacing, which
             *    reads as a cramped, broken layout.
             */}
            <OvokThemeProvider
              theme={{
                colors: DEFAULT_COLORS,
                dark: systemColorScheme === 'dark',
                spacingMultiplier: DEFAULT_MULTIPLIERS.spacing,
                borderRadiusMultiplier: DEFAULT_MULTIPLIERS.borderRadius,
              }}
            >
              <BottomSheetModalProvider>
                <BSMPVOVK>
                  <StatusBar style="auto" />
                  <SampleDataBanner />
                  <Stack>
                    <Stack.Screen name="index" options={{ title: 'Ovok App' }} />
                    <Stack.Screen name="settings" options={{ title: 'Settings' }} />
                  </Stack>
                </BSMPVOVK>
              </BottomSheetModalProvider>
            </OvokThemeProvider>
          </OvokProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
