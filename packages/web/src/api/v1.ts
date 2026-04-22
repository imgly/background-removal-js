export default removeBackground;
export {
  preload,
  removeBackground,
  removeForeground,
  alphamask,
  segmentForeground,
  applySegmentationMask,
  processMask,
  composeWithBackground,
  createCheckerboardBg,
  getSegmentationMask
};
export type { Config, ImageSource, MaskConfig, BackgroundConfig };

import memoize from 'lodash-es/memoize';

import { initInference, runInference } from '../inference';
import { Config, validateConfig } from '../schema';
import * as utils from '../utils';
import { ImageSource } from '../utils';
import ndarray, { NdArray } from 'ndarray';

type MaskConfig = {
  smoothness?: number;
  feather?: number;
  edgeMode?: 'auto' | 'hard' | 'soft' | 'blur';
  contrast?: number;
  threshold?: number;
};

type BackgroundConfig = {
  type?: 'transparent' | 'solid' | 'image' | 'checkerboard';
  color?: { r?: number; g?: number; b?: number };
  image?: ImageSource;
  checkerboard?: {
    tileSize?: number;
    color1?: { r?: number; g?: number; b?: number };
    color2?: { r?: number; g?: number; b?: number };
  };
};

const init = memoize(initInference, (config) => JSON.stringify(config));

async function preload(configuration?: Config): Promise<void> {
  await init(configuration);
  return;
}

function processMask(
  mask: NdArray<Uint8Array>,
  maskConfig: MaskConfig
): NdArray<Uint8Array> {
  let result = mask;

  if (maskConfig.edgeMode && maskConfig.edgeMode !== 'auto') {
    result = utils.applyEdgeMode(result, maskConfig.edgeMode);
  }

  if (maskConfig.contrast && maskConfig.contrast !== 0) {
    result = utils.applyContrast(result, maskConfig.contrast);
  }

  if (maskConfig.smoothness && maskConfig.smoothness > 0) {
    result = utils.applySmoothMask(result, maskConfig.smoothness);
  }

  if (maskConfig.feather && maskConfig.feather > 0) {
    result = utils.applyFeatherMask(result, maskConfig.feather);
  }

  if (maskConfig.threshold !== undefined) {
    result = utils.applyThreshold(result, maskConfig.threshold);
  }

  return result;
}

async function composeWithBackground(
  foreground: NdArray<Uint8Array>,
  backgroundConfig: BackgroundConfig
): Promise<NdArray<Uint8Array>> {
  const [height, width] = foreground.shape;

  if (!backgroundConfig.type || backgroundConfig.type === 'transparent') {
    return foreground;
  }

  let background: NdArray<Uint8Array> | { r: number; g: number; b: number };

  if (backgroundConfig.type === 'solid' && backgroundConfig.color) {
    background = {
      r: backgroundConfig.color.r ?? 255,
      g: backgroundConfig.color.g ?? 255,
      b: backgroundConfig.color.b ?? 255
    };
  } else if (backgroundConfig.type === 'checkerboard') {
    const cb = backgroundConfig.checkerboard || {};
    const color1 = cb.color1 || {};
    const color2 = cb.color2 || {};
    background = utils.createCheckerboardBackground(
      width,
      height,
      cb.tileSize || 16,
      { r: color1.r ?? 255, g: color1.g ?? 255, b: color1.b ?? 255 },
      { r: color2.r ?? 204, g: color2.g ?? 204, b: color2.b ?? 204 }
    );
  } else if (backgroundConfig.type === 'image' && backgroundConfig.image) {
    background = await utils.imageSourceToImageData(backgroundConfig.image, {} as Config);
  } else {
    return foreground;
  }

  return utils.composeImageWithBackground(foreground, background);
}

function createCheckerboardBg(
  width: number,
  height: number,
  tileSize: number = 16,
  color1: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 },
  color2: { r: number; g: number; b: number } = { r: 204, g: 204, b: 204 }
): NdArray<Uint8Array> {
  return utils.createCheckerboardBackground(width, height, tileSize, color1, color2);
}

async function getSegmentationMask(
  image: ImageSource,
  configuration?: Config
): Promise<NdArray<Uint8Array>> {
  const { config, session } = await init(configuration);
  const inputImageTensor = await utils.imageSourceToImageData(image, config);
  const [alphamask] = await runInference(inputImageTensor, config, session);
  return alphamask;
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

  if (config.progress) config.progress('compute:decode', 0, 5);

  const inputImageTensor = await utils.imageSourceToImageData(image, config);

  config.progress?.('compute:inference', 1, 5);
  let [alphamask, imageTensor] = await runInference(
    inputImageTensor,
    config,
    session
  );

  config.progress?.('compute:mask', 2, 5);
  
  if (config.mask && (config.mask.smoothness || config.mask.feather || config.mask.edgeMode !== 'auto' || config.mask.contrast !== 0 || config.mask.threshold !== undefined)) {
    alphamask = processMask(alphamask, config.mask);
  }

  config.progress?.('compute:compose', 3, 5);
  const [width, height] = imageTensor.shape;
  const stride = width * height;
  for (let i = 0; i < stride; i += 1) {
    imageTensor.data[4 * i + 3] = alphamask.data[i];
  }

  let outImageTensor = imageTensor;
  if (config.background && config.background.type !== 'transparent') {
    outImageTensor = await composeWithBackground(imageTensor, config.background);
  }

  config.progress?.('compute:encode', 4, 5);
  const outImage = await utils.imageEncode(
    outImageTensor,
    config.output.quality,
    config.output.format
  );
  config.progress?.('compute:encode', 5, 5);

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
