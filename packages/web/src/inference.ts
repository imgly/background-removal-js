export { initInference, runInference };

import { tensorResize, tensorHWCtoBCHW } from './utils';
import { createOnnxSession, runOnnxSession } from './onnx';
import { calculateProportionalSize } from './utils';
import { Config, validateConfig } from './schema';
import ndarray, { NdArray } from 'ndarray';
import { loadAsBlob } from './resource';

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
  let tensorImage = await tensorResize(imageTensor, resolution, resolution);
  const inputTensor = tensorHWCtoBCHW(tensorImage);
  const predictionsDict = await runOnnxSession(
    session,
    [['input', inputTensor]],
    ['output']
  );

  const stride = resolution * resolution;

  for (let i = 0; i < 4 * stride; i += 4) {
    let idx = i / 4;
    let alpha = predictionsDict[0].data[idx];
    tensorImage.data[i + 3] = alpha * 255;
  }

  const [width, height] = calculateProportionalSize(
    srcWidth,
    srcHeight,
    resolution,
    resolution
  );

  const dst_width = Math.min(width, srcWidth);
  const dst_height = Math.min(height, srcHeight);

  tensorImage = await tensorResize(tensorImage, dst_width, dst_height);
  if (config.progress) config.progress('compute:inference', 1, 1);
  return ndarray(tensorImage.data, [dst_height, dst_width, 4]);
}
