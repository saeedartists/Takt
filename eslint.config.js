/*
 * Flat config (ESLint 9). Base rules from eslint-config-expo; prettier
 * last so formatting rules never fight stylistic plugins.
 */
const expo = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  ...expo,
  prettierConfig,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'android/**',
      'ios/**',
      '.expo/**',
      'build-artifacts/**',
      'store-assets/**',
      'site/**',
      'downloads/**',
      'server/dist/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['warn', 'smart'],
      /*
       * react-hooks v7 strictness for an existing RN codebase:
       * ref-during-render powers the enter-animation guards here, and
       * effects that sync persisted state trigger the set-state rule.
       * Kept as warnings to track down file by file; not CI-gating.
       */
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      /*
       * react-hooks/immutability false-positives on React Native idioms:
       * Reanimated shared values are `.value =`-mutated by design, and
       * Date.now() inside useMemo is the standard time-window pattern.
       */
      'react-hooks/immutability': 'off',
      // Platform-suffixed modules (time-field.native/web) resolve via moduleSuffixes at build time.
      'import/no-unresolved': [
        'error',
        { ignore: ['\\./time-field$', 'time-field$'] },
      ],
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: { __dirname: 'readonly', process: 'readonly', require: 'readonly', module: 'writable', console: 'readonly' },
    },
  },
  {
    files: ['server/**/*.ts'],
    rules: {
      'import/no-extraneous-dependencies': 'off',
    },
  },
];
