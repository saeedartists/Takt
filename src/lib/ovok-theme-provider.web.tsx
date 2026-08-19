import type { PropsWithChildren } from 'react';

type ThemeInput = {
  colors: Record<string, string>;
  dark: boolean;
  spacingMultiplier: number;
  borderRadiusMultiplier: number;
};

export const DEFAULT_COLORS = {
  error: '#B42318',
  primary: '#000000',
  secondary: '#6F767E',
  text: '#111827',
  white: '#FFFFFF',
  black: '#000000',
  inputBackground: '#FFFFFF',
  inputBorder: '#D0D5DD',
  disabled: '#EAECF0',
  placeholderText: '#98A2B3',
  background: '#FAFAF9',
  cardBackground: '#FFFFFF',
  iconBackground: '#F2F4F7',
  divider: '#EAECF0',
  grayBackground: '#F8F9FC',
} as const;

export const DEFAULT_MULTIPLIERS = {
  spacing: 1,
  borderRadius: 1,
} as const;

export function OvokThemeProvider({ children }: PropsWithChildren<{ theme: ThemeInput }>) {
  return children;
}
