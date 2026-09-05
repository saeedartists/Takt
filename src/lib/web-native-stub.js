// ponytail: empty stand-in for native-only modules that Metro pulls into the web
// graph via barrel imports (e.g. @ovok/native -> react-native-pdf). Web never
// renders these screens. Drop this once those imports are lazy or web-guarded.
module.exports = new Proxy(function () {}, { get: () => undefined });
