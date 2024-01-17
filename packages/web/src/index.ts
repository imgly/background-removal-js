export default removeBackground;
export {
  preload,
  removeBackground,
  removeForeground,
  segmentForeground,
  applySegmentationMask
};
export type { Config, ImageSource };

import { memoize } from 'lodash';
import ndarray from 'ndarray';
import { initInference, runInference } from './inference';
import { preload as preloadResources } from './resource';
import { Config, validateConfig } from './schema';
import * as utils from './utils';
import { ImageSource } from './utils';

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

  const imageTensor = await utils.imageSourceToImageData(image, config);
  const [width, height, channels] = imageTensor.shape;

  const alphamask = await runInference(imageTensor, config, session);
  const stride = width * height;

  const outImageTensor = imageTensor;
  for (let i = 0; i < stride; i += 1) {
    outImageTensor.data[4 * i + 3] = alphamask.data[i];
  }

  const outImage = await utils.imageEncode(
    outImageTensor,
    config.output.quality,
    config.output.format
  );

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
  const [width, height, channels] = imageTensor.shape;

  const alphamask = await runInference(imageTensor, config, session);
  const stride = width * height;
  const outImageTensor = imageTensor;
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
async function segmentForeground(
  image: ImageSource,
  configuration?: Config
): Promise<Blob> {
  const { config, session } = await init(configuration);

  const imageTensor = await utils.imageSourceToImageData(image, config);
  const [height, width, channels] = imageTensor.shape;

  const alphamask = await runInference(imageTensor, config, session);

  switch (config.output.format) {
    case 'image/x-alpha8': {
      const outImage = await utils.imageEncode(
        alphamask,
        config.output.quality,
        config.output.format
      );
      return outImage;
    }
    default: {
      const stride = width * height;
      const outImageTensor = ndarray(new Uint8Array(channels * stride), [
        height,
        width,
        channels
      ]);
      for (let i = 0; i < stride; i += 1) {
        const index = 4 * i + 3;
        outImageTensor.data[index] = alphamask.data[i]; //Red
        outImageTensor.data[index + 1] = alphamask.data[i]; //Green
        outImageTensor.data[index + 2] = alphamask.data[i]; // Blue
        outImageTensor.data[index + 3] = 255;
      }
      const outImage = await utils.imageEncode(
        outImageTensor,
        config.output.quality,
        config.output.format
      );
      return outImage;
    }
  }
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
  console.log([maskHeight, maskWidth, maskChannels]);
  console.log([imageHeight, imageWidth, imageChannels]);

  const alphaMask =
    maskHeight !== imageHeight || maskWidth !== imageWidth
      ? utils.tensorResizeBilinear(maskTensor, imageWidth, imageHeight)
      : maskTensor;
  const stride = imageWidth * imageHeight;
  for (let i = 0; i < stride; i += 1) {
    const idxImage = imageChannels * i;
    const idxMask = maskChannels * i;
    imageTensor.data[idxImage + 3] = alphaMask.data[idxMask]; // alpha information it always in the first (sometimes also in the others)
  }

  const outImage = await utils.imageEncode(
    imageTensor,
    config.output.quality,
    config.output.format
  );

  return outImage;
}
