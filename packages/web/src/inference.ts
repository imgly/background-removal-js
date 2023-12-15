export { initInference, runInference };

import pkg from '../package.json';
import { tensorResizeBilinear, tensorHWCtoBCHW } from './utils';
import { createOnnxSession, runOnnxSession } from './onnx';
import { Config, validateConfig } from './schema';

import { loadAsBlob } from './resource';
import ndarray, { NdArray } from 'ndarray';

function convertFloat32ToUint8(
  float32Array: NdArray<Float32Array>
): NdArray<Uint8Array> {
  const uint8Array = new Uint8Array(float32Array.data.length);
  for (let i = 0; i < float32Array.data.length; i++) {
    uint8Array[i] = float32Array.data[i] * 255;
  }
  return ndarray(uint8Array, float32Array.shape);
}

async function initInference(config?: Config) {
  config = validateConfig(config);

  if (config.debug) console.debug('Loading model...');
  const model = config.model;
  const blob = await loadAsBlob(`/models/${model}`, config);
  const arrayBuffer = await blob.arrayBuffer();
  const session = await createOnnxSession(arrayBuffer, config);
  return { config, session };
}

async function runInference(
  imageTensor: NdArray<Uint8Array>,
  config: Config,
  session: any
): Promise<NdArray<Uint8Array>> {
  if (config.progress) config.progress('compute:inference', 0, 1);
  const resolution = 1024;
  const [srcHeight, srcWidth, srcChannels] = imageTensor.shape;

  let tensorImage = tensorResizeBilinear(imageTensor, resolution, resolution);
  const inputTensor = tensorHWCtoBCHW(tensorImage); // this converts also from float to rgba

  // run
  const predictionsDict = await runOnnxSession(
    session,
    [['input', inputTensor]],
    ['output']
  );

  let alphamask = ndarray(predictionsDict[0].data, [resolution, resolution, 1]);
  alphamask = convertFloat32ToUint8(alphamask);
  alphamask = tensorResizeBilinear(alphamask, srcWidth, srcHeight);

  if (config.progress) config.progress('compute:inference', 1, 1);
  return alphamask;
}
