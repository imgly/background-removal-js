export { platform, Platform }

const Platform = {
  Unknown,
  Node,
  Browser,
  Deno,
  Electron,
  ReactNative
};

const isBrowser = typeof window !== 'undefined';
const isNode =
  typeof process !== 'undefined' && process.versions && process.versions.node;
const isDeno = typeof Deno !== 'undefined';
const isElectron =
  typeof window !== 'undefined' &&
  window.process &&
  window.process.type === 'renderer';
const isReactNative =
  typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
const isBun = typeof window !== 'undefined' && window.__BUN__;

const platform = (() => {
  if (isBrowser) return Platform.Browser;
  if (isNode) return Platform.Node;
  if (isDeno) return Platform.Deno;
  if (isElectron) return Platform.Electron;
  if (isReactNative) return Platform.ReactNative;
  if (isBun) return Platform.Bun;
  return Platform.Unknown;
})();
