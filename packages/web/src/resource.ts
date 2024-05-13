export { loadAsBlob, loadAsUrl, preload };

import { Config } from './schema';

async function preload(config: Config): Promise<void> {
  // load resource metadata
  const resourceUrl = new URL('resources.json', config.publicPath);
  const resourceResponse = await fetch(resourceUrl);
  if (!resourceResponse.ok) {
    throw new Error(
      `Resource metadata not found. Ensure that the config.publicPath is configured correctly: ${config.publicPath}`
    );
  }
  const resourceMap = await resourceResponse.json();
  const keys = Object.keys(resourceMap);

  await Promise.all(
    keys.map(async (key) => {
      return loadAsBlob(key, config);
    })
  );
}

async function loadAsUrl(url: string, config: Config): Promise<string> {
  return URL.createObjectURL(await loadAsBlob(url, config));
}

async function loadAsBlob(key: string, config: Config) {
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

  const chunks = entry.chunks; // list of entries

  let downloadedSize = 0;
  const responses = chunks.map(async (chunk) => {
    const chunkSize = chunk.offsets[1] - chunk.offsets[0];
    const url = config.publicPath
      ? new URL(chunk.hash, config.publicPath).toString()
      : chunk.hash;
    const response = await fetch(url, config.fetchArgs);
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
