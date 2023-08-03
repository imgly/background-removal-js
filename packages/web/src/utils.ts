export {
  imageDecode,
  imageEncode,
  tensorResize,
  tensorHWCtoBCHW,
  imageBitmapToImageData,
  calculateProportionalSize,
  isAbsoluteURL,
  ensureAbsoluteURL
};

import ndarray, { NdArray } from 'ndarray';
import { imageDecode, imageEncode } from './codecs';

function imageBitmapToImageData(imageBitmap: ImageBitmap): ImageData {
  var canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  var ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageBitmap, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function imageResize(
  imageData: NdArray<Uint8Array>,
  newWidth: number,
  newHeight: number
): Promise<NdArray<Uint8Array>> {
  const [srcHeight, srcWidth, srcChannels] = imageData.shape;
  if (srcChannels !== 4) throw new Error('Only RGBA images are supported');
  const dstLength = newWidth * newHeight * srcChannels;
  const newData = new Uint8ClampedArray(dstLength);
  const xRatio = srcWidth / newWidth;
  const yRatio = srcHeight / newHeight;

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIndex = (srcY * srcWidth + srcX) * srcChannels;
      const dstIndex = (y * newWidth + x) * srcChannels;
      for (let i = 0; i < srcChannels; i++) {
        newData[dstIndex + i] = imageData.data[srcIndex + i];
      }
    }
  }

  return ndarray(new Uint8Array(newData), [newHeight, newWidth, srcChannels]);
}

async function tensorResize(
  imageTensor: NdArray<Uint8Array>,
  newWidth: number,
  newHeight: number
): Promise<NdArray<Uint8Array>> {
  const [srcHeight, srcWidth, srcChannels] = imageTensor.shape;
  const imageData = new ImageData(imageTensor.data, srcWidth, srcHeight);
  const bitmap = await createImageBitmap(imageData, {
    resizeWidth: newWidth,
    resizeHeight: newHeight,
    resizeQuality: 'high',
    premultiplyAlpha: 'premultiply'
  });
  const outImageData = imageBitmapToImageData(bitmap);
  return ndarray(outImageData.data, [
    outImageData.height,
    outImageData.width,
    4
  ]);
}

function tensorHWCtoBCHW(
  imageTensor: NdArray<Uint32Array>,
  mean: number[] = [128, 128, 128],
  std: number[] = [256, 256, 256]
): NdArray<Float32Array> {
  var imageBufferData = imageTensor.data;
  const [srcHeight, srcWidth, srcChannels] = imageTensor.shape;
  const stride = srcHeight * srcWidth;
  const float32Data = new Float32Array(3 * stride);

  // r_0, r_1, .... g_0,g_1, .... b_0
  for (let i = 0, j = 0; i < imageBufferData.length; i += 4, j += 1) {
    float32Data[j] = (imageBufferData[i] - mean[0]) / std[0];
    float32Data[j + stride] = (imageBufferData[i + 1] - mean[1]) / std[1];
    float32Data[j + stride + stride] =
      (imageBufferData[i + 2] - mean[2]) / std[2];
  }

  return ndarray(float32Data, [1, 3, srcHeight, srcWidth]);
}

function calculateProportionalSize(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): [number, number] {
  const widthRatio = maxWidth / originalWidth;
  const heightRatio = maxHeight / originalHeight;
  const scalingFactor = Math.min(widthRatio, heightRatio);
  const newWidth = Math.floor(originalWidth * scalingFactor);
  const newHeight = Math.floor(originalHeight * scalingFactor);
  return [newWidth, newHeight];
}

function isAbsoluteURL(url: string): boolean {
  const regExp = new RegExp('^(?:[a-z+]+:)?//', 'i');
  return regExp.test(url); // true - regular http absolute URL
}

function ensureAbsoluteURL(url: string): string {
  if (isAbsoluteURL(url)) {
    return url;
  } else {
    return new URL(url, window.location.href).href;
  }
}
