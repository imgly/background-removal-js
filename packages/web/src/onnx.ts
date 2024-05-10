export { createOnnxSession, runOnnxSession };

import ndarray, { NdArray } from 'ndarray';
import type ORT from 'onnxruntime-web';

import * as ort_cpu from 'onnxruntime-web';
import * as ort_gpu from 'onnxruntime-web/webgpu';

import { loadAsUrl } from './resource';
import * as feat from './features';
import { Config } from './schema';

async function createOnnxSession(model: any, config: Config) {
  const useWebGPU = config.device === 'gpu';
  const useThreads = await feat.threads();
  const useSimd = feat.simd();
  const proxyToWorker = config.proxyToWorker;
  const executionProviders = [useWebGPU ? 'webgpu' : 'wasm'];
  const ort = useWebGPU ? ort_gpu : ort_cpu;

  if (config.debug) {
    console.debug('\tUsing Threads:', useThreads);
    console.debug('\tUsing SIMD:', useSimd);
    console.debug('\tUsing WebGPU:', useWebGPU);
    console.debug('\tProxy to Worker:', proxyToWorker);

    ort.env.debug = true;
    ort.env.logLevel = 'verbose';
  }

  ort.env.wasm.numThreads = feat.maxNumThreads();
  ort.env.wasm.simd = feat.simd();
  ort.env.wasm.proxy = proxyToWorker;

  const wasmPaths = {
    'ort-wasm-simd-threaded.wasm': useThreads && useSimd,
    'ort-wasm-simd.wasm': !useThreads && useSimd,
    'ort-wasm-threaded.wasm': !useWebGPU && useThreads && !useSimd,
    'ort-wasm.wasm': !useWebGPU && !useThreads && !useSimd
  };

  const proxiedWasmPaths = {};
  for (const [key, value] of Object.entries(wasmPaths)) {
    if (value) {
      const wasmPath =
        useWebGPU && key.includes('simd')
          ? `/onnxruntime-web/${key.replace('.wasm', '.jsep.wasm')}`
          : `/onnxruntime-web/${key}`;
      proxiedWasmPaths[key] = await loadAsUrl(wasmPath, config);
    }
  }

  ort.env.wasm.wasmPaths = proxiedWasmPaths;

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
  const useWebGPU = config.device === 'gpu';
  const ort = useWebGPU ? ort_gpu : ort_cpu;

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
