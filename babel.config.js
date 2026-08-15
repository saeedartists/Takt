module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'react' }],
    ],
    plugins: [
      // react-native-reanimated/plugin MUST be listed last. Reanimated 4
      // moved the plugin to the worklets package but the alias still
      // works via a shim; keep this here explicitly rather than relying
      // on the shim in case it goes away in a future release.
      'react-native-worklets/plugin',
    ],
  };
};
