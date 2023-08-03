import { imageDataResize, tensorHWCtoBCHW } from './utils';
import { runOnnxSession } from './onnx';
import { calculateProportionalSize } from './utils';
import { Config } from './schema';
import ndarray, { NdArray } from 'ndarray';

export async function runInference(
  imageTensor: NdArray<Float32Array>,
  config: Config,
  session: any
): Promise<NdArray<Float32Array>> {
  if (config.progress) config.progress('compute:inference', 0, 1);
  const resolution = 1024;
  const [srcHeight, srcWidth, srcChannels] = imageTensor.shape;

  let tensorImage = await imageDataResize(imageTensor, resolution, resolution);

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

  tensorImage = await imageDataResize(tensorImage, dst_width, dst_height);
  if (config.progress) config.progress('compute:inference', 1, 1);
  return ndarray(tensorImage.data, [dst_height, dst_width, 4]);
}
