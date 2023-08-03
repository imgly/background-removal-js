export { load, loadAsUrl };

import { Config } from './schema';

async function loadAsUrl(url: string, config: Config) {
  URL.createObjectURL(await load(url, config));
}
async function load(key: string, config: Config) {
  // load resource metadata
  const resourceUrl = new URL('resources.json', config.publicPath);
  const resourceResponse = await fetch(resourceUrl);
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

  let url = entry.hash;
  if (config.publicPath) {
    url = new URL(url, config.publicPath).toString();
  }
  const response = await fetch(url, config.fetchArgs);

  const chunks = config.progress
    ? await fetchChunked(response, entry, config, key)
    : [await response.blob()];

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
