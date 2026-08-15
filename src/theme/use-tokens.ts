import { useColorScheme } from 'react-native';

import { iosPalette, semantic } from './tokens';

/*
 * useTokens — resolve the scheme-dependent half of the token set.
 *
 * Scheme-independent tokens (categoryColors, radius, typography,
 * spacing) are imported directly from ./tokens; only colours that flip
 * between light and dark come through this hook. That keeps most
 * components free of hook plumbing.
 */
export const useTokens = () => {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return {
    scheme,
    c: semantic[scheme],
    palette: iosPalette[scheme],
  } as const;
};
