// Metro config for Expo SDK 57. getDefaultConfig ships the Expo-specific
// resolver + transformer defaults; layer local overrides on top.

const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const nativeStub = path.resolve(__dirname, 'src/lib/web-native-stub.js');

// These packages register TurboModules that Expo Go (and some Takt
// binaries) do not ship. Resolve them to a JS stub so a published
// EAS Update can boot when someone scans the QR in Expo Go.
const expoGoMissingNativeModules = [
  'react-native-permissions',
  'react-native-ble-plx',
  'react-native-pdf',
  'react-native-blob-util',
  '@kingstinct/react-native-healthkit',
  'react-native-health-connect',
  '@react-native-google-signin/google-signin',
  'expo-health-connect',
];

const extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
};
for (const name of expoGoMissingNativeModules) {
  extraNodeModules[name] = nativeStub;
}
config.resolver.extraNodeModules = extraNodeModules;

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isMissingNative = expoGoMissingNativeModules.some(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`),
  );
  if (isMissingNative) {
    return { type: 'sourceFile', filePath: nativeStub };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
