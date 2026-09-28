import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

// react-native-svg's Defs typing omits children (same workaround as sparkline.tsx).
const SvgDefs = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

import { font, motion, radius, spacing, typography } from '../../theme/tokens';
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
 * FloatingTabBar — an ink capsule floating 16pt off the screen edges.
 * The active tab grows into a pastel pill carrying its name; the width
 * change is a layout transition, so the pill appears to slide between
 * tabs. Inactive tabs keep a small label (icons alone fail older eyes).
 */
export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { c } = useTokens();
  const insets = useSafeAreaInsets();
  const { reduce } = useMotion();
  const layout = reduce ? undefined : LinearTransition.springify().damping(22).stiffness(220);

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingBottom: Math.max(insets.bottom - 10, spacing(3)) }]}>
      {/* Content scrolls away under a soft paper fade instead of a hard edge. */}
      <View pointerEvents="none" style={styles.fade}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <SvgDefs>
            <LinearGradient id="tabFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.background} stopOpacity={0} />
              <Stop offset="0.55" stopColor={c.background} stopOpacity={0.92} />
              <Stop offset="1" stopColor={c.background} stopOpacity={1} />
            </LinearGradient>
          </SvgDefs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#tabFade)" />
        </Svg>
      </View>
      <View
        accessibilityRole="tablist"
        style={[styles.bar, { backgroundColor: c.chrome }, Platform.OS === 'web' ? styles.webShadow : styles.shadow]}
      >
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
            <Animated.View key={route.key} layout={layout} style={focused ? styles.activeSlot : styles.slot}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={badge ? `${label}, ${badge}` : label}
                onPress={onPress}
                {...(Platform.OS === 'web' ? ({ href: `/${route.name}` } as object) : null)}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                style={({ pressed }) => [
                  focused ? styles.activePill : styles.item,
                  focused && { backgroundColor: c.accentSoft },
                  pressed && !focused && { opacity: 0.6 },
                ]}
              >
                <TabIcon name={focused ? icons.on : icons.off} focused={focused} color={focused ? '#15171C' : c.onChrome} size={focused ? 19 : 21} />
                {focused ? (
                  <Animated.Text
                    entering={reduce ? undefined : FadeIn.delay(90).duration(180)}
                    exiting={reduce ? undefined : FadeOut.duration(90)}
                    numberOfLines={1}
                    style={[typography.subhead, { color: '#15171C', fontFamily: font.bold }]}
                  >
                    {label}
                  </Animated.Text>
                ) : (
                  <Text numberOfLines={1} style={[styles.label, { color: c.onChrome }]}>
                    {label}
                  </Text>
                )}
                {badge != null && !focused ? (
                  <View style={[styles.badge, { backgroundColor: c.accentSoft, borderColor: c.chrome }]}>
                    <Text style={[styles.badgeText, { color: '#15171C' }]}>{badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

/** Icon that gives a small, damped "tick" when its tab becomes active. */
function TabIcon({ name, focused, color, size }: { name: IconName; focused: boolean; color: string; size: number }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) {
      scale.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, motion.spring.snappy));
    }
  }, [focused, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animated}>
      {name === 'medical' || name === 'medical-outline' ? (
        <PillIcon size={size} color={color} filled={focused} />
      ) : (
        <Ionicons name={name} size={size} color={color} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(6),
    alignItems: 'center',
  },
  fade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  bar: {
    width: '100%',
    maxWidth: 420,
    height: 64,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  shadow: {
    shadowColor: '#15171C',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  webShadow: { boxShadow: '0 12px 32px -12px rgba(21,23,28,0.45)' } as object,
  // Inactive tabs share what the active pill leaves; the pill sizes to its label.
  slot: { flex: 1, alignItems: 'center' },
  activeSlot: { flexGrow: 0, flexShrink: 0 },
  item: {
    minWidth: 52,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing(1),
  },
  activePill: {
    height: 48,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingLeft: spacing(3.5),
    paddingRight: spacing(4),
  },
  label: { fontFamily: font.semibold, fontSize: 12, lineHeight: 15 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: font.bold, fontSize: 11, lineHeight: 14 },
});
