export { loadAsBlob, loadAsUrl, loadFromURI };

import { Config } from './schema';
import { ensureAbsoluteURI } from './url';
import { readFile } from 'fs/promises';

async function loadAsUrl(url: string, config: Config) {
  return URL.createObjectURL(await loadAsBlob(url, config));
}

async function loadFromURI(
  uri: URL,
  config = { headers: { 'Content-Type': 'application/octet-stream' } }
) {
  switch (uri.protocol) {
    case 'http:':
      return await fetch(uri);
    case 'https:':
      return await fetch(uri);
    case 'file:': {
      const buffer = await readFile(uri);
      return new Response(buffer, { status: 200, headers: config.headers });
    }
    default:
      throw new Error(`Unsupported protocol: ${uri.protocol}`);
  }
}
async function loadAsBlob(key: string, config: Config) {
  // load resource metadata

  const resourceUri = ensureAbsoluteURI('./resources.json', config.publicPath);

  const resourceResponse = await loadFromURI(resourceUri);
  if (!resourceResponse.ok) {
    throw new Error(
      `Resource metadata not found. Ensure that the config.publicPath is configured correctly.`
    );
  }
  const resourceMap = await resourceResponse.json();
  const entry = resourceMap[key];

  if (!entry) {
    throw new Error(
      `Resource ${key} not found. Ensure that the config.publicPath is configured correctly.`
    );
  }

  let paths = Object.keys(entry.chunks);

  const allChunks = await Promise.all(
    paths.map(async (path) => {
      const url = ensureAbsoluteURI(path, config.publicPath);
      const response = await loadFromURI(url, {
        headers: { 'Content-Type': entry.mime }
      });

      const chunks = config.progress
        ? await fetchChunked(response, entry, config, key)
        : [await response.blob()];
      return chunks;
    })
  );

  const chunks = allChunks.flat();
  const data = new Blob(chunks, { type: entry.mime });
  if (data.size !== entry.size) {
    throw new Error(
      `Failed to fetch ${key} with size ${entry.size} but got ${data.size}`
    );
  }
  return data;
}

async function fetchChunked(
  response: Response,
  entry: any,
  config: Config,
  key: string
) {
  const reader = response.body!.getReader();
  // let contentLength = Number(response.headers.get('Content-Length'));
  const contentLength = entry.size ?? 0;
  let receivedLength = 0;

  let chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    receivedLength += value.length;
    if (config.progress)
      config.progress(`fetch:${key}`, receivedLength, contentLength);
  }
  return chunks;
}
