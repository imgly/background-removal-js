export { loadAsBlob, loadAsUrl, loadAsArrayBuffer, preload, resolveChunkUrls, clearCache };

import { Config } from './schema';

const CACHE_NAME = 'imgly-background-removal-v1';
const resourceMetadataCache = new Map<string, any>();
const blobCache = new Map<string, Blob>();

async function getOrCreateCache(): Promise<Cache> {
  if (typeof caches === 'undefined') {
    return null as any;
  }
  try {
    return await caches.open(CACHE_NAME);
  } catch (e) {
    console.warn('Cache API not available:', e);
    return null as any;
  }
}

async function loadResourceMetadata(config: Config): Promise<any> {
  const cacheKey = config.publicPath;
  if (resourceMetadataCache.has(cacheKey)) {
    return resourceMetadataCache.get(cacheKey);
  }

  const resourceUrl = new URL('resources.json', config.publicPath);
  const cache = await getOrCreateCache();
  
  if (cache) {
    const cachedResponse = await cache.match(resourceUrl.toString());
    if (cachedResponse) {
      const resourceMap = await cachedResponse.json();
      resourceMetadataCache.set(cacheKey, resourceMap);
      return resourceMap;
    }
  }

  const resourceResponse = await fetch(resourceUrl);
  if (!resourceResponse.ok) {
    throw new Error(
      `Resource metadata not found. Ensure that the config.publicPath is configured correctly: ${config.publicPath}`
    );
  }
  
  const resourceMap = await resourceResponse.json();
  resourceMetadataCache.set(cacheKey, resourceMap);
  
  if (cache) {
    const clonedResponse = new Response(JSON.stringify(resourceMap), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put(resourceUrl.toString(), clonedResponse);
  }
  
  return resourceMap;
}

async function clearCache(): Promise<void> {
  resourceMetadataCache.clear();
  blobCache.clear();
  if (typeof caches !== 'undefined') {
    try {
      await caches.delete(CACHE_NAME);
    } catch (e) {
      console.warn('Failed to clear cache:', e);
    }
  }
}

async function preload(config: Config): Promise<void> {
  const resourceMap = await loadResourceMetadata(config);
  const keys = Object.keys(resourceMap);

  for (const key of keys) {
    await loadAsBlob(key, config);
  }
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

  const cache = await getOrCreateCache();
  if (cache) {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      blobCache.set(cacheKey, blob);
      return blob;
    }
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

    let response = null;
    let blob = null;

    if (cache) {
      const cachedChunk = await cache.match(url);
      if (cachedChunk) {
        blob = await cachedChunk.blob();
        if (chunkSize === blob.size) {
          response = cachedChunk;
        } else {
          blob = null;
        }
      }
    }

    if (!blob) {
      response = await fetch(url, config.fetchArgs);
      blob = await response.blob();

      if (chunkSize !== blob.size) {
        throw new Error(
          `Failed to fetch ${key} with size ${chunkSize} but got ${blob.size}`
        );
      }

      if (cache) {
        const clonedResponse = new Response(blob, {
          headers: { 'Content-Type': blob.type || 'application/octet-stream' }
        });
        await cache.put(url, clonedResponse);
      }
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
  if (cache) {
    const clonedResponse = new Response(data, {
      headers: { 'Content-Type': entry.mime || 'application/octet-stream' }
    });
    await cache.put(cacheKey, clonedResponse);
  }

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
