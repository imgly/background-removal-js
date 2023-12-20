export { createOnnxSession, runOnnxSession };

import ndarray, { NdArray } from 'ndarray';
import * as ort from 'onnxruntime-web';
import { loadAsUrl } from './resource';
import { simd, threads } from './feature-detect';
import { Config } from './schema';

async function createOnnxSession(model: any, config: Config) {
  const capabilities = {
    simd: await simd(),
    threads: await threads(),
    numThreads: navigator.hardwareConcurrency ?? 4,
    // @ts-ignore
    webgpu: navigator.gpu !== undefined
  };
  if (config.debug) {
    console.debug('Capabilities:', capabilities);
    ort.env.debug = true;
    ort.env.logLevel = 'verbose';
  }

  ort.env.wasm.numThreads = capabilities.numThreads;
  ort.env.wasm.simd = capabilities.simd;
  ort.env.wasm.proxy = config.proxyToWorker;

  ort.env.wasm.wasmPaths = {
    'ort-wasm-simd-threaded.wasm':
      capabilities.simd && capabilities.threads
        ? await loadAsUrl(
            '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
            config
          )
        : undefined,
    'ort-wasm-simd.wasm':
      capabilities.simd && !capabilities.threads
        ? await loadAsUrl('/onnxruntime-web/ort-wasm-simd.wasm', config)
        : undefined,
    'ort-wasm-threaded.wasm':
      !capabilities.simd && capabilities.threads
        ? await loadAsUrl('/onnxruntime-web/ort-wasm-threaded.wasm', config)
        : undefined,
    'ort-wasm.wasm':
      !capabilities.simd && !capabilities.threads
        ? await loadAsUrl('/onnxruntime-web/ort-wasm.wasm', config)
        : undefined
  };

  if (config.debug) {
    console.debug('ort.env.wasm:', ort.env.wasm);
  }

  const ort_config: ort.InferenceSession.SessionOptions = {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
    executionMode: 'parallel',
    enableCpuMemArena: true
  };

  const session = await ort.InferenceSession.create(model, ort_config).catch(
    (e: any) => {
      throw new Error(
        `Failed to create session: ${e}. Please check if the publicPath is set correctly.`
      );
    }
  );
  return session;
}

async function runOnnxSession(
  session: any,
  inputs: [string, NdArray<Float32Array>][],
  outputs: [string]
) {
  const feeds: Record<string, any> = {};
  for (const [key, tensor] of inputs) {
    feeds[key] = new ort.Tensor(
      'float32',
      new Float32Array(tensor.data),
      tensor.shape
    );
  }
  const outputData = await session.run(feeds, {});
  const outputKVPairs: NdArray<Float32Array>[] = [];

  for (const key of outputs) {
    const output: ort.Tensor = outputData[key];
    const shape: Number[] = output.dims as number[];
    const data: Float32Array = output.data as Float32Array;
    const tensor = ndarray(data, shape);
    outputKVPairs.push(tensor);
  }

  return outputKVPairs;
}
