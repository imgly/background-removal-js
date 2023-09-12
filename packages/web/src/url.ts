export { isAbsoluteURI, ensureAbsoluteURI };

function isAbsoluteURI(url: string): boolean {
  const regExp = new RegExp('^(?:[a-z+]+:)?//', 'i');
  return regExp.test(url); // true - regular http absolute URL
}

const isNode = typeof window === 'undefined';
const isBrowser = typeof window !== 'undefined';

function ensureAbsoluteURI(url: string, baseUrl: string): string {
  if (isAbsoluteURI(url)) {
    return url;
  } else {
    return new URL(url, baseUrl).href;
  }
}
