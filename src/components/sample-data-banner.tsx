import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isOvokMockActive } from '../lib/mock-server';
import { useTokens } from '../theme/use-tokens';

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
  // Hooks run unconditionally; the early return comes after.
  const insets = useSafeAreaInsets();
  const { c } = useTokens();
  if (!isOvokMockActive()) return null;

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + 6,
          backgroundColor: `${c.warning}1F`,
          borderBottomColor: `${c.warning}66`,
        },
      ]}
      accessibilityRole="alert"
    >
      <View style={[styles.dot, { backgroundColor: c.warning }]} />
      <Text style={[styles.label, { color: c.textPrimary }]}>Sample data — not real patient records</Text>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
});
