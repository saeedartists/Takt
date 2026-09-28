import { useState, type ReactElement } from 'react';
// @ts-expect-error react-native-web ships no types; Metro resolves this file on web only.
import { unstable_createElement } from 'react-native-web';

import { font, radius, spacing, typography, useTokens } from '@/components/ui';
import type { TimeFieldProps } from './time-field.native';

const createElement = unstable_createElement as (
  type: string,
  props: Record<string, unknown>,
) => ReactElement;

/*
 * TimeField (web) — the browser's own <input type="time|date">, dressed
 * like `Input`: same height, radius, and the ink border on focus.
 * Values are the same strings the native field emits: HH:MM / YYYY-MM-DD.
 */
export const TimeField = ({
  mode,
  value,
  onChange,
  accessibilityLabel,
  invalid = false,
  autoFocus = false,
}: TimeFieldProps) => {
  const { c, isDark } = useTokens();
  const [focused, setFocused] = useState(false);
  const borderColor = invalid ? c.destructive : focused ? c.textPrimary : c.separator;

  return createElement('input', {
    type: mode,
    value,
    autoFocus,
    'aria-label': accessibilityLabel,
    'aria-invalid': invalid,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      minHeight: 56,
      borderWidth: focused || invalid ? 2 : 1.5,
      borderStyle: 'solid',
      borderColor,
      borderRadius: radius.md,
      paddingHorizontal: spacing(4.5),
      ...typography.body,
      // Raw DOM input: no RNW font inheritance, so name the brand face (loaded by expo-font) explicitly.
      fontFamily: `${font.regular}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`,
      color: c.textPrimary,
      backgroundColor: c.surface,
      outlineWidth: 0,
      colorScheme: isDark ? 'dark' : 'light',
      width: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
    },
  });
};
