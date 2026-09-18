// Stand-in for native-only packages that are not in Expo Go (and may be
// missing from a Takt binary). @ovok/native barrel-imports these at
// startup; without a stub, TurboModuleRegistry.getEnforcing('RNPermissions')
// crashes the JS bundle. Takt does not use these modules.

const asyncUnavailable = () => Promise.resolve('unavailable');

const deepStub = new Proxy(asyncUnavailable, {
  get: (_target, prop) => {
    if (prop === 'then' || prop === 'catch' || prop === 'finally') {
      return undefined;
    }
    if (prop === Symbol.toPrimitive) {
      return () => '';
    }
    return deepStub;
  },
  apply: () => Promise.resolve('unavailable'),
});

module.exports = new Proxy(function NativeStub() {}, {
  get: () => deepStub,
});
