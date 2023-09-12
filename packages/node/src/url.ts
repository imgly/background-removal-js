export { ensureAbsoluteURI };

function isAbsoluteURI(url: string): boolean {
  const regExp = new RegExp('^(?:[a-z+]+:)?//', 'i');
  return regExp.test(url); // true - regular http absolute URL
}

function ensureAbsoluteURI(url: string, baseUrl: string): URL {
  if (isAbsoluteURI(url)) {
    return new URL(url);
  } else {
    return new URL(url, baseUrl);
  }
}
