export { loadAsBlob, loadAsUrl, loadAsArrayBuffer, preload, resolveChunkUrls };

import { Config } from './schema';

const resourceMetadataCache = new Map<string, any>();
const blobCache = new Map<string, Blob>();

async function loadResourceMetadata(config: Config): Promise<any> {
  const cacheKey = config.publicPath;
  if (resourceMetadataCache.has(cacheKey)) {
    return resourceMetadataCache.get(cacheKey);
  }

  const resourceUrl = new URL('resources.json', config.publicPath);
  const resourceResponse = await fetch(resourceUrl);
  if (!resourceResponse.ok) {
    throw new Error(
      `Resource metadata not found. Ensure that the config.publicPath is configured correctly: ${config.publicPath}`
    );
  }
  const resourceMap = await resourceResponse.json();
  resourceMetadataCache.set(cacheKey, resourceMap);
  return resourceMap;
}

async function preload(config: Config): Promise<void> {
  const resourceMap = await loadResourceMetadata(config);
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
async function loadAsArrayBuffer(
  url: string,
  config: Config
): Promise<ArrayBuffer> {
  return await (await loadAsBlob(url, config)).arrayBuffer();
}

async function loadAsBlob(key: string, config: Config) {
  const cacheKey = `${config.publicPath}:${key}`;
  
  if (blobCache.has(cacheKey)) {
    return blobCache.get(cacheKey)!;
  }

  const resourceMap = await loadResourceMetadata(config);
  const entry = resourceMap[key];

  if (!entry) {
    throw new Error(
      `Resource ${key} not found. Ensure that the config.publicPath is configured correctly.`
    );
  }

  const chunks = entry.chunks;

  let downloadedSize = 0;
  const responses = chunks.map(async (chunk) => {
    const chunkSize = chunk.offsets[1] - chunk.offsets[0];
    const url = config.publicPath
      ? new URL(chunk.name, config.publicPath).toString()
      : chunk.name;
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

  const allChunkData = await Promise.all(responses);

  const data = new Blob(allChunkData, { type: entry.mime });
  if (data.size !== entry.size) {
    throw new Error(
      `Failed to fetch ${key} with size ${entry.size} but got ${data.size}`
    );
  }

  blobCache.set(cacheKey, data);
  return data;
}

async function resolveChunkUrls(key: string, config: Config) {
  const resourceMap = await loadResourceMetadata(config);
  const entry = resourceMap[key];

  if (!entry) {
    throw new Error(
      `Resource ${key} not found. Ensure that the config.publicPath is configured correctly.`
    );
  }

  const chunks = entry.chunks;

  const allUrls = chunks.map((chunk) => {
    return config.publicPath
      ? new URL(chunk.name, config.publicPath).toString()
      : chunk.name;
  });

  return allUrls;
}
