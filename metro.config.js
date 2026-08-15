// Metro config for Expo SDK 56. getDefaultConfig ships the Expo-specific
// resolver + transformer defaults; layer local overrides on top.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
