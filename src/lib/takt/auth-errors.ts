export const isBackendAuthNotReady = (message: string): boolean =>
  /(cannot\s+post|not\s+found|404|disabled|forbidden|not enabled|unavailable)/i.test(message);
