export { createOnnxSession, runOnnxSession };

import ndarray, { NdArray } from 'ndarray';
import * as ort from 'onnxruntime-node';
// import * as ort from 'onnxruntime-node-gpu';
import { Config } from './schema';

async function createOnnxSession(model: any, config: Config) {
  if (config.debug) {
    ort.env.debug = true;
    ort.env.logLevel = 'verbose';
    console.debug('ort.env.wasm:', ort.env.wasm);
  }

  const ort_config: ort.InferenceSession.SessionOptions = {
    graphOptimizationLevel: 'all',
    executionMode: 'parallel'
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
