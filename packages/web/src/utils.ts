export {
  imageDecode,
  imageEncode,
  tensorResizeBilinear,
  tensorHWCtoBCHW,
  imageBitmapToImageData,
  imageSourceToImageData,
  type ImageSource,
  createCanvas
};

import ndarray, { NdArray, TypedArray } from 'ndarray';
import { imageDecode, imageEncode } from './codecs';
import { ensureAbsoluteURI } from './url';
import { Config } from './schema';

type ImageSource =
  | ImageData
  | ArrayBuffer
  | Uint8Array
  | Blob
  | URL
  | string
  | NdArray<Uint8Array>;

function imageBitmapToImageData(imageBitmap: ImageBitmap): ImageData {
  var canvas = createCanvas(imageBitmap.width, imageBitmap.height);
  var ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageBitmap, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function createTypeArray<T extends TypedArray>(length: number) {
  if (typeof Uint8Array !== 'undefined') {
    return new Uint8Array(length) as T;
  } else if (typeof Uint8ClampedArray !== 'undefined') {
    return new Uint8ClampedArray(length) as T;
  } else if (typeof Uint16Array !== 'undefined') {
    return new Uint16Array(length) as T;
  } else if (typeof Uint32Array !== 'undefined') {
    return new Uint32Array(length) as T;
  } else if (typeof Float32Array !== 'undefined') {
    return new Float32Array(length) as T;
  } else if (typeof Float64Array !== 'undefined') {
    return new Float64Array(length) as T;
  } else {
    throw new Error('TypedArray not supported');
  }
}
function tensorResizeBilinear<T extends TypedArray>(
  imageTensor: NdArray<T>,
  newWidth: number,
  newHeight: number,
  proportional: boolean = false
): NdArray<T> {
  const [srcHeight, srcWidth, srcChannels] = imageTensor.shape;

  let scaleX = srcWidth / newWidth;
  let scaleY = srcHeight / newHeight;

  if (proportional) {
    const downscaling = Math.max(scaleX, scaleY) > 1.0;
    scaleX = scaleY = downscaling
      ? Math.max(scaleX, scaleY)
      : Math.min(scaleX, scaleY);
  }

  // Create a new NdArray to store the resized image
  const resizedImageData = ndarray(
    createTypeArray<T>(srcChannels * newWidth * newHeight),
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
        // console.log(interpolatedValue);
        resizedImageData.set(y, x, c, interpolatedValue);
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

async function imageSourceToImageData(
  image: ImageSource,
  config: Config
): Promise<NdArray<Uint8Array>> {
  if (typeof image === 'string') {
    image = ensureAbsoluteURI(image, config.publicPath);
    image = new URL(image);
  }
  if (image instanceof URL) {
    const response = await fetch(image, {});
    image = await response.blob();
  }
  if (image instanceof ArrayBuffer || ArrayBuffer.isView(image)) {
    image = new Blob([image]);
  }
  if (image instanceof Blob) {
    image = await imageDecode(image);
  }

  return image as NdArray<Uint8Array>;
}
export function convertFloat32ToUint8(
  float32Array: NdArray<Float32Array>
): NdArray<Uint8Array> {
  const uint8Array = new Uint8Array(float32Array.data.length);
  for (let i = 0; i < float32Array.data.length; i++) {
    uint8Array[i] = float32Array.data[i] * 255;
  }
  return ndarray(uint8Array, float32Array.shape);
}

function createCanvas(width, height) {
  let canvas = undefined;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height);
  } else {
    canvas = document.createElement('canvas');
  }

  if (!canvas) {
    throw new Error(
      `Canvas nor OffscreenCanvas are available in the current context.`
    );
  }
  return canvas;
}
