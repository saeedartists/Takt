import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONTENT_MAX_WIDTH, INK, font, spacing } from '../../theme/tokens';
import { useMotion } from '../../theme/use-motion';
import { useTokens } from '../../theme/use-tokens';
import { triggerHaptic } from './animated-pressable';
import { PillIcon } from './brand-icons';
import type { IconName } from './controls';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, { on: IconName; off: IconName }> = {
  today: { on: 'home', off: 'home-outline' },
  medications: { on: 'medical', off: 'medical-outline' },
  history: { on: 'stats-chart', off: 'stats-chart-outline' },
  settings: { on: 'options', off: 'options-outline' },
};

/*
 * Tab bar — docked to the bottom edge like a native iOS bar: a surface
 * strip with a hairline, four equal tabs, icon over label. The active tab
 * gets a soft pastel indicator behind its icon that grows in, and its
 * label turns ink and bold (state is never colour alone). Content ends
 * above the bar instead of scrolling under it.
 */
export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { c } = useTokens();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: c.surface,
          borderTopColor: c.separator,
          paddingBottom: Math.max(insets.bottom, spacing(2)),
        },
      ]}
    >
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options ?? {};
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;
          const icons = ICONS[route.name] ?? { on: 'ellipse', off: 'ellipse-outline' };
          const badge = options.tabBarBadge;

          const onPress = (e?: { preventDefault?: () => void }) => {
            // Web renders the tab as a real link (keyboard, middle-click, e2e); keep routing in-app.
            e?.preventDefault?.();
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              triggerHaptic('light');
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${label}, ${badge}` : label}
              onPress={onPress}
              {...(Platform.OS === 'web' ? ({ href: `/${route.name}` } as object) : null)}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [styles.item, pressed && !focused && { opacity: 0.55 }]}
            >
              <TabIndicator focused={focused} tint={c.accentSoft}>
                {route.name === 'medications' ? (
                  <PillIcon size={22} color={focused ? INK : c.textSecondary} filled={focused} />
                ) : (
                  <Ionicons name={focused ? icons.on : icons.off} size={22} color={focused ? INK : c.textSecondary} />
                )}
                {badge != null && !focused ? (
                  <View style={[styles.badge, { backgroundColor: c.accent, borderColor: c.surface }]}>
                    <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>{badge}</Text>
                  </View>
                ) : null}
              </TabIndicator>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: focused ? c.textPrimary : c.textSecondary, fontFamily: focused ? font.bold : font.medium },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/*
 * The pastel pill behind the active icon: it widens from the icon's size
 * and fades in (no overshoot), and the icon gives one small lift.
 */
function TabIndicator({ focused, tint, children }: { focused: boolean; tint: string; children: React.ReactNode }) {
  const { reduce } = useMotion();
  const t = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    t.value = reduce
      ? focused
        ? 1
        : 0
      : focused
        ? withSpring(1, { damping: 22, stiffness: 260, overshootClamping: true })
        : withTiming(0, { duration: 140 });
  }, [focused, reduce, t]);

  const pill = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ scaleX: interpolate(t.value, [0, 1], [0.5, 1]) }],
  }));

  return (
    <View style={styles.iconWrap}>
      <Animated.View pointerEvents="none" style={[styles.indicator, { backgroundColor: tint }, pill]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing(2),
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing(2),
  },
  item: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrap: { width: 60, height: 32, alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', width: 60, height: 32, borderRadius: 16 },
  label: { fontSize: 12, lineHeight: 15 },
  badge: {
    position: 'absolute',
    top: -2,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: font.bold, fontSize: 10, lineHeight: 12 },
});
