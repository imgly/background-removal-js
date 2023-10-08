export { platform, Platform };

enum Platform {
  Unknown,
  Node,
  Browser,
  Deno,
  Electron,
  ReactNative,
  Bun
};

const isBrowser = typeof window !== 'undefined' && typeof Deno === 'undefined';
const isNode =
  typeof process !== 'undefined' &&
  typeof Bun === 'undefined' &&
  process.versions &&
  Boolean(process.versions.node);
const isDeno = typeof Deno !== 'undefined';
const isElectron =
  typeof window !== 'undefined' &&
  typeof window.process !== 'undefined' &&
  window.process.type === 'renderer';
const isReactNative =
  typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
const isBun = typeof Bun !== 'undefined' && typeof Bun.version === 'string';

const platform = (() => {
  if (isBrowser) return Platform.Browser;
  if (isNode) return Platform.Node;
  if (isDeno) return Platform.Deno;
  if (isElectron) return Platform.Electron;
  if (isReactNative) return Platform.ReactNative;
  if (isBun) return Platform.Bun;
  return Platform.Unknown;
})();

