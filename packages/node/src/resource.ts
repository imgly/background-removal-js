export { loadAsBlob, loadAsUrl, loadFromURI };

import { Config } from './schema';
import { ensureAbsoluteURI } from './url';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';

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
      const buffer = await readFile(fileURLToPath(uri));
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

  const chunks = entry.chunks; // list of entries

  let downloadedSize = 0;
  const responses = chunks.map(async (chunk) => {
    const url = ensureAbsoluteURI(chunk.hash, config.publicPath);
    const chunkSize = chunk.offsets[1] - chunk.offsets[0];
    const response = await loadFromURI(url, {
      headers: { 'Content-Type': entry.mime }
    });
    const blob = await response.blob();

    if (chunkSize !== blob.size) {
      throw new Error(
        `Failed to fetch ${key} with size ${chunkSize} but got ${blob.size}`
      );
    }

    if (config.progress) {
      downloadedSize += chunkSize;
      config.progress(`fetch:${key}`, downloadedSize, entry.size);
    }
    return blob;
  });

  // we could create a new buffer here and use the chunk entries and combine the file instead

  const allChunkData = await Promise.all(responses);

  const data = new Blob(allChunkData, { type: entry.mime });
  if (data.size !== entry.size) {
    throw new Error(
      `Failed to fetch ${key} with size ${entry.size} but got ${data.size}`
    );
  }
  return data;
}
