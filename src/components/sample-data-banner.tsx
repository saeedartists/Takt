import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isOvokMockActive } from '../lib/mock-server';

/*
 * Persistent, non-dismissible banner shown whenever the app is serving
 * synthetic demo data from src/lib/seed/fixtures.ts instead of a live
 * Ovok tenant.
 *
 * This is a safety control, not decoration. A clinical UI full of
 * plausible-looking patient names is dangerous if the viewer cannot
 * tell it is fake. Do not add a dismiss button and do not render it
 * conditionally per screen.
 *
 * It disappears on its own once EXPO_PUBLIC_OVOK_MOCK is unset (i.e.
 * the app points at a real tenant), so there is nothing to remove
 * before shipping.
 *
 * Rendered inside the provider chain in app/_layout.tsx, above the
 * navigator, so it sits under the status bar on every screen.
 */
export const SampleDataBanner = () => {
  /*
   * Hooks must run unconditionally, so read insets before the early
   * return. The banner sits above <Stack> — i.e. outside any screen's
   * SafeAreaView — so without the top inset it renders under the
   * status bar / notch and the text is clipped on most devices.
   */
  const insets = useSafeAreaInsets();
  if (!isOvokMockActive()) return null;

  return (
    <View
      style={[styles.bar, { paddingTop: insets.top + 6 }]}
      accessibilityRole="alert"
    >
      <View style={styles.dot} />
      <Text style={styles.label}>Sample data — not real patient records</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFF5EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FDC687',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C06C0C',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#63300D',
  },
});
