export { createOnnxSession, runOnnxSession };

import ndarray, { NdArray } from 'ndarray';
import type ORT from 'onnxruntime-web';

import * as ort_cpu from 'onnxruntime-web';
// @ts-ignore
import * as ort_gpu from 'onnxruntime-web/webgpu';

import { loadAsUrl } from './resource';
import { simd, threads } from './feature-detect';
import { Config } from './schema';

async function createOnnxSession(model: any, config: Config) {
  const ort = config.device === 'gpu' ? ort_gpu : ort_cpu;
  const capabilities = {
    simd: await simd(),
    threads: await threads(),
    numThreads: navigator.hardwareConcurrency ?? 4,
    // @ts-ignore
    webgpu: navigator.gpu !== undefined
  };

  const useWebGPU = config.device === 'gpu' && capabilities.webgpu;
  const useThreads = capabilities.threads;
  const useSimd = capabilities.simd;

  const executionProviders = [useWebGPU ? 'webgpu' : 'wasm'];

  if (config.debug) {
    console.debug('Capabilities:', capabilities);
    console.debug('Using WebGPU:', useWebGPU);
    console.debug('Using Threads:', useThreads);
    console.debug('Using SIMD:', useSimd);
    ort.env.debug = true;
    ort.env.logLevel = 'verbose';
  }

  ort.env.wasm.numThreads = capabilities.numThreads;
  ort.env.wasm.simd = capabilities.simd;
  ort.env.wasm.proxy = useWebGPU ? false : config.proxyToWorker;

  ort.env.wasm.wasmPaths = {
    'ort-wasm-simd-threaded.wasm':
      useThreads && useSimd
        ? await loadAsUrl(
            useWebGPU
              ? '/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm'
              : '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
            config
          )
        : undefined,
    'ort-wasm-simd.wasm':
      !useThreads && useSimd
        ? await loadAsUrl(
            useWebGPU
              ? '/onnxruntime-web/ort-wasm-simd.jsep.wasm'
              : '/onnxruntime-web/ort-wasm-simd.wasm',
            config
          )
        : undefined,
    'ort-wasm-threaded.wasm':
      !useWebGPU && useThreads && !useSimd
        ? await loadAsUrl('/onnxruntime-web/ort-wasm-threaded.wasm', config)
        : undefined,
    'ort-wasm.wasm':
      !useWebGPU && !useThreads && !useSimd
        ? await loadAsUrl('/onnxruntime-web/ort-wasm.wasm', config)
        : undefined
  };

  if (config.debug) {
    console.debug('ort.env.wasm:', ort.env.wasm);
  }

  const ort_config: ORT.InferenceSession.SessionOptions = {
    executionProviders: executionProviders,
    graphOptimizationLevel: 'all',
    executionMode: 'parallel',
    enableCpuMemArena: true
  };

  const session = await ort.InferenceSession.create(model, ort_config).catch(
    (e: any) => {
      throw new Error(
        `Failed to create session: "${e}". Please check if the publicPath is set correctly.`
      );
    }
  );
  return session;
}

async function runOnnxSession(
  session: any,
  inputs: [string, NdArray<Float32Array>][],
  outputs: [string],
  config: Config
) {
  const ort = config.device === 'gpu' ? ort_gpu : ort_cpu;
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
    const output: ORT.Tensor = outputData[key];
    const shape: number[] = output.dims as number[];
    const data: Float32Array = output.data as Float32Array;
    const tensor = ndarray(data, shape);
    outputKVPairs.push(tensor);
  }

  return outputKVPairs;
}
