export {
  isAbsoluteURI as isAbsoluteURL,
  ensureAbsoluteURI as ensureAbsoluteURL
};

function isAbsoluteURI(url: string): boolean {
  const regExp = new RegExp('^(?:[a-z+]+:)?//', 'i');
  return regExp.test(url); // true - regular http absolute URL
}
function ensureAbsoluteURI(url: string): string {
  if (isAbsoluteURI(url)) {
    return url;
  } else {
    return new URL(url, window.location.href).href;
  }
}
