/*
 * Entry point (CommonJS on purpose).
 *
 * OvokClient requires the web-API polyfills to be in place before ANY of
 * its modules are evaluated — and `app/_layout.tsx` statically imports
 * `ovok-client.ts`, which constructs OvokClient at module scope, so the
 * tree evaluates before any component code runs. Keeping this file in
 * require form guarantees the polyfill call lands first; the app module
 * below only loads once these globals exist.
 *
 * See: https://docs.ovok.com/native-sdk/components/polyfills
 */
const { polyfillMedplumWebAPIs } = require('@medplum/expo-polyfills');

polyfillMedplumWebAPIs();
require('expo-router/entry');
