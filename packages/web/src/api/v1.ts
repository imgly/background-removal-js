export default removeBackground;
export {
  preload,
  removeBackground,
  removeForeground,
  alphamask,
  segmentForeground,
  applySegmentationMask
};
export type { Config, ImageSource };

import { memoize } from 'lodash';

import { initInference, runInference } from '../inference';
import { preload as preloadResources } from '../resource';
import { Config, validateConfig } from '../schema';
import * as utils from '../utils';
import { ImageSource } from '../utils';

const init = memoize(initInference, (config) => JSON.stringify(config));

async function preload(configuration?: Config): Promise<void> {
  const config = validateConfig(configuration);
  await preloadResources(config);
  return;
}

/**
 * Removes the background from an image.
 *
 * @param image - The image to remove the background from.
 * @param configuration - Optional configuration for the background removal process.
 * @returns A Promise that resolves to the resulting image with the background removed.
 */
async function removeBackground(
  image: ImageSource,
  configuration?: Config
): Promise<Blob> {
  const { config, session } = await init(configuration);

  if (config.progress) config.progress('compute:decode', 0, 4);

  const inputImageTensor = await utils.imageSourceToImageData(image, config);

  config.progress?.('compute:inference', 1, 4);
  const [alphamask, imageTensor] = await runInference(
    inputImageTensor,
    config,
    session
  );

  config.progress?.('compute:mask', 2, 4);
  const outImageTensor = imageTensor;
  const [width, height] = outImageTensor.shape;
  const stride = width * height;
  for (let i = 0; i < stride; i += 1) {
    outImageTensor.data[4 * i + 3] = alphamask.data[i];
  }
  config.progress?.('compute:encode', 3, 4);
  const outImage = await utils.imageEncode(
    outImageTensor,
    config.output.quality,
    config.output.format
  );
  config.progress?.('compute:encode', 4, 4);

  return outImage;
}

/**
 * Removes the foreground from an image.
 *
 * @param image - The image to remove the foreground from.
 * @param configuration - Optional configuration for the foreground removal process.
 * @returns A Promise that resolves to the resulting image with the foreground removed.
 */
async function removeForeground(
  image: ImageSource,
  configuration?: Config
): Promise<Blob> {
  const { config, session } = await init(configuration);

  const imageTensor = await utils.imageSourceToImageData(image, config);
  const [alphamask, imageInput] = await runInference(
    imageTensor,
    config,
    session
  );

  const outImageTensor = imageInput;
  const [width, height, channels] = outImageTensor.shape;
  const stride = width * height;
  for (let i = 0; i < stride; i += 1) {
    outImageTensor.data[4 * i + 3] = 255 - alphamask.data[i];
  }

  const outImage = await utils.imageEncode(
    outImageTensor,
    config.output.quality,
    config.output.format
  );

  return outImage;
}

/**
 * Segments the foreground of an image using a given configuration.
 *
 * @param image - The image source to segment.
 * @param configuration - The optional configuration for the segmentation.
 * @returns A Promise that resolves to the segmented foreground as a Blob.
 */

const alphamask = segmentForeground;
async function segmentForeground(
  image: ImageSource,
  configuration?: Config
): Promise<Blob> {
  const { config, session } = await init(configuration);

  const imageTensor = await utils.imageSourceToImageData(image, config);
  let [height, width, channels] = imageTensor.shape;

  const [alphamask, imageInput] = await runInference(
    imageTensor,
    config,
    session
  );

  const stride = width * height;
  const outImageTensor = imageTensor;
  for (let i = 0; i < stride; i += 1) {
    const index = 4 * i;

    let alpha = alphamask.data[i];

    outImageTensor.data[index] = 255;
    outImageTensor.data[index + 1] = 255;
    outImageTensor.data[index + 2] = 255;
    outImageTensor.data[index + 3] = alpha;
  }

  const outImage = await utils.imageEncode(
    outImageTensor,
    config.output.quality,
    config.output.format
  );
  return outImage;
}

async function applySegmentationMask(
  image,
  mask,
  config?: Config
): Promise<Blob> {
  config = validateConfig(config);
  const imageTensor = await utils.imageSourceToImageData(image, config);
  const [imageHeight, imageWidth, imageChannels] = imageTensor.shape;
  const maskTensor = await utils.imageSourceToImageData(mask, config);
  const [maskHeight, maskWidth, maskChannels] = maskTensor.shape;

  const alphaMask =
    maskHeight !== imageHeight || maskWidth !== imageWidth
      ? utils.tensorResizeBilinear(maskTensor, imageWidth, imageHeight)
      : maskTensor;
  const stride = imageWidth * imageHeight;
  for (let i = 0; i < stride; i += 1) {
    const idxImage = imageChannels * i;
    const idxMask = maskChannels * i;
    imageTensor.data[idxImage + 3] = alphaMask.data[idxMask + 3];
  }

  const outImage = await utils.imageEncode(
    imageTensor,
    config.output.quality,
    config.output.format
  );

  return outImage;
}
