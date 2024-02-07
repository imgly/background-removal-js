export {
  imageDecode,
  imageEncode,
  tensorResizeBilinear,
  tensorHWCtoBCHW,
  calculateProportionalSize,
  imageSourceToImageData,
  ImageSource,
  convertFloat32ToUint8
};

import { Config } from './schema';
import * as codecs from './codecs';
import { ensureAbsoluteURI } from './url';
import { loadFromURI } from './resource';

import ndarray, { NdArray } from 'ndarray';
import { imageDecode, imageEncode } from './codecs';

type ImageSource =
  | ArrayBuffer
  | Uint8Array
  | Blob
  | URL
  | string
  | NdArray<Uint8Array>;

function tensorResizeBilinear(
  imageTensor: NdArray<Uint8Array>,
  newWidth: number,
  newHeight: number
): NdArray<Uint8Array> {
  const [srcHeight, srcWidth, srcChannels] = imageTensor.shape;
  // Calculate the scaling factors
  const scaleX = srcWidth / newWidth;
  const scaleY = srcHeight / newHeight;

  // Create a new NdArray to store the resized image
  const resizedImageData = ndarray(
    new Uint8Array(srcChannels * newWidth * newHeight),
    [newHeight, newWidth, srcChannels]
  );
  // Perform interpolation to fill the resized NdArray
  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = x * scaleX;
      const srcY = y * scaleY;
      const x1 = Math.max(Math.floor(srcX), 0);
      const x2 = Math.min(Math.ceil(srcX), srcWidth - 1);
      const y1 = Math.max(Math.floor(srcY), 0);
      const y2 = Math.min(Math.ceil(srcY), srcHeight - 1);

      const dx = srcX - x1;
      const dy = srcY - y1;

      for (let c = 0; c < srcChannels; c++) {
        const p1 = imageTensor.get(y1, x1, c);
        const p2 = imageTensor.get(y1, x2, c);
        const p3 = imageTensor.get(y2, x1, c);
        const p4 = imageTensor.get(y2, x2, c);

        // Perform bilinear interpolation
        const interpolatedValue =
          (1 - dx) * (1 - dy) * p1 +
          dx * (1 - dy) * p2 +
          (1 - dx) * dy * p3 +
          dx * dy * p4;

        resizedImageData.set(y, x, c, Math.round(interpolatedValue));
      }
    }
  }

  return resizedImageData;
}

function tensorHWCtoBCHW(
  imageTensor: NdArray<Uint8Array>,
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

async function imageSourceToImageData(
  image: ImageSource,
  _: Config
): Promise<NdArray<Uint8Array>> {
  if (typeof image === 'string') {
    image = ensureAbsoluteURI(image, `file://${process.cwd()}/`);
  }
  if (image instanceof URL) {
    image = await (await loadFromURI(image)).blob();
  }
  if (image instanceof ArrayBuffer || ArrayBuffer.isView(image)) {
    image = new Blob([image]);
  }
  if (image instanceof Blob) {
    image = await codecs.imageDecode(image);
  }

  return image as NdArray<Uint8Array>;
}

function convertFloat32ToUint8(
  float32Array: NdArray<Float32Array>
): NdArray<Uint8Array> {
  const uint8Array = new Uint8Array(float32Array.data.length);
  for (let i = 0; i < float32Array.data.length; i++) {
    uint8Array[i] = float32Array.data[i] * 255;
  }
  return ndarray(uint8Array, float32Array.shape);
}
