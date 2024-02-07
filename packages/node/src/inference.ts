export { initInference, runInference };

import { tensorResizeBilinear, tensorHWCtoBCHW } from './utils';
import { createOnnxSession, runOnnxSession } from './onnx';
import { Config, validateConfig } from './schema';

import { loadAsBlob } from './resource';
import ndarray, { NdArray } from 'ndarray';
import { convertFloat32ToUint8 } from './utils';

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
  let alphamaskU8 = convertFloat32ToUint8(alphamask);
  alphamaskU8 = tensorResizeBilinear(alphamaskU8, srcWidth, srcHeight);

  if (config.progress) config.progress('compute:inference', 1, 1);
  return alphamaskU8;
}
