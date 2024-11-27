export { createOnnxSession, runOnnxSession };

import ndarray, { NdArray } from 'ndarray';
import type ORT from 'onnxruntime-web';

import * as ort_cpu from 'onnxruntime-web';
import * as ort_gpu from 'onnxruntime-web/webgpu';

import * as caps from './capabilities';
import { Config } from './schema';
import { loadAsUrl, resolveChunkUrls } from './resource';

async function createOnnxSession(model: any, config: Config) {
  const useWebGPU = config.device === 'gpu' && (await caps.webgpu());
  // BUG: proxyToWorker is not working for WASM/CPU Backend for now
  const proxyToWorker = useWebGPU && config.proxyToWorker;
  const executionProviders = [useWebGPU ? 'webgpu' : 'wasm'];
  const ort = useWebGPU ? ort_gpu : ort_cpu;

  if (config.debug) {
    console.debug('\tUsing WebGPU:', useWebGPU);
    console.debug('\tProxy to Worker:', proxyToWorker);

    ort.env.debug = true;
    ort.env.logLevel = 'verbose';
  }

  ort.env.wasm.numThreads = caps.maxNumThreads();
  ort.env.wasm.proxy = proxyToWorker;

  // The path inside the resource bundle
  const baseFilePath = useWebGPU
    ? '/onnxruntime-web/ort-wasm-simd-threaded.jsep'
    : '/onnxruntime-web/ort-wasm-simd-threaded';

  const wasmPath = await loadAsUrl(`${baseFilePath}.wasm`, config);
  const mjsPath = await loadAsUrl(`${baseFilePath}.mjs`, config);

  ort.env.wasm.wasmPaths = {
    mjs: mjsPath,
    wasm: wasmPath
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
  const useWebGPU = config.device === 'gpu' && (await caps.webgpu());
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
