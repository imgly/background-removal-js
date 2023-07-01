export { preload, fetchKey as fetch };

import { Config } from './schema';
import _ from 'lodash';

type Entry = {
  url: string;
  size: number;
  mime: string;
};
const bundle: Map<string, Entry> = new Map([
  [
    'small',
    {
      url: require('../bundle/models/7001d60734fdc112dd9c062635fb59cd401fb82a9d4213134bce4dbd655c803a.onnx'),
      size: 44342436,
      mime: 'application/octet-stream'
    }
  ],
  [
    'medium',
    {
      url: require('../bundle/models/b6e8497ba978a6f5fbb647e419d2696cd80df5a23cb6a8ea532021911bd76acb.onnx'),
      size: 88188479,
      mime: 'application/octet-stream'
    }
  ],
  // [
  //   'large',
  //   {
  //     url: require('../bundle/models/17b7466d93bb60b0e88affa2b0e8b3eee309c7de183d394ce4b956339ebd95e6.onnx'),
  //     size: 176173887,
  //     mime: 'application/octet-stream'
  //   }
  // ],
  [
    'ort-wasm-simd-threaded.jsep.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm'),
      size: 18215132,
      mime: 'application/wasm'
    }
  ],
  [
    'ort-wasm-simd.jsep.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm-simd.jsep.wasm'),
      size: 16836274,
      mime: 'application/wasm'
    }
  ],
  [
    'ort-wasm-simd-threaded.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'),
      size: 10281838,
      mime: 'application/wasm'
    }
  ],
  [
    'ort-wasm-simd.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm'),
      size: 10335238,
      mime: 'application/wasm'
    }
  ],
  [
    'ort-wasm-threaded.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm-threaded.wasm'),
      size: 9413659,
      mime: 'application/wasm'
    }
  ],
  [
    'ort-wasm.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm.wasm'),
      size: 9487920,
      mime: 'application/wasm'
    }
  ]
]);

async function fetchKey(key: string, config: Config) {
  const entry = bundle.get(key)!;
  let url = entry.url;
  if (config.publicPath) {
    url = new URL(url.split('/').pop()!, config.publicPath).toString();
  }

  const response = await fetch(url, config.fetchArgs);

  let chunks = await fetchChunked(response, entry, config, key);
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

async function preload(config: Config) {
  // This will warmup the caches
  let result = new Map(bundle);
  result.forEach(async (_, key) => {
    await fetchKey(key, config);
  });
  return result;
}
