export {
  imageDecode,
  imageEncode,
  tensorResizeBilinear,
  tensorHWCtoBCHW,
  imageBitmapToImageData,
  imageSourceToImageData,
  type ImageSource,
  createCanvas,
  applyGaussianBlur,
  applyBoxBlur,
  applySmoothMask,
  applyFeatherMask,
  applyContrast,
  applyThreshold,
  applyErosion,
  applyDilation,
  applyEdgeMode,
  composeImageWithBackground,
  createCheckerboardBackground
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
  const srcData = imageTensor.data;

  let scaleX = srcWidth / newWidth;
  let scaleY = srcHeight / newHeight;

  if (proportional) {
    const downscaling = Math.max(scaleX, scaleY) > 1.0;
    scaleX = scaleY = downscaling
      ? Math.max(scaleX, scaleY)
      : Math.min(scaleX, scaleY);
  }

  const dstData = createTypeArray<T>(srcChannels * newWidth * newHeight);
  const srcStrideY = srcWidth * srcChannels;
  const srcStrideX = srcChannels;
  const dstStrideY = newWidth * srcChannels;
  const dstStrideX = srcChannels;

  for (let y = 0; y < newHeight; y++) {
    const dstY = y * dstStrideY;
    const srcYf = y * scaleY;
    const srcY1 = Math.max(Math.floor(srcYf), 0);
    const srcY2 = Math.min(Math.ceil(srcYf), srcHeight - 1);
    const dy = srcYf - srcY1;
    const srcY1Idx = srcY1 * srcStrideY;
    const srcY2Idx = srcY2 * srcStrideY;

    for (let x = 0; x < newWidth; x++) {
      const dstIdx = dstY + x * dstStrideX;
      const srcXf = x * scaleX;
      const srcX1 = Math.max(Math.floor(srcXf), 0);
      const srcX2 = Math.min(Math.ceil(srcXf), srcWidth - 1);
      const dx = srcXf - srcX1;
      const srcX1Idx = srcX1 * srcStrideX;
      const srcX2Idx = srcX2 * srcStrideX;

      for (let c = 0; c < srcChannels; c++) {
        const p1 = srcData[srcY1Idx + srcX1Idx + c];
        const p2 = srcData[srcY1Idx + srcX2Idx + c];
        const p3 = srcData[srcY2Idx + srcX1Idx + c];
        const p4 = srcData[srcY2Idx + srcX2Idx + c];

        const interpolatedValue =
          (1 - dx) * (1 - dy) * p1 +
          dx * (1 - dy) * p2 +
          (1 - dx) * dy * p3 +
          dx * dy * p4;

        dstData[dstIdx + c] = interpolatedValue;
      }
    }
  }

  return ndarray(dstData, [newHeight, newWidth, srcChannels]);
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

function createGaussianKernel(sigma: number, radius: number): number[] {
  const kernelSize = radius * 2 + 1;
  const kernel = new Array(kernelSize);
  let sum = 0;

  for (let i = 0; i < kernelSize; i++) {
    const x = i - radius;
    const exponent = -(x * x) / (2 * sigma * sigma);
    kernel[i] = Math.exp(exponent);
    sum += kernel[i];
  }

  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

function applyBoxBlur<T extends TypedArray>(
  imageTensor: NdArray<T>,
  radius: number
): NdArray<T> {
  if (radius <= 0) return imageTensor;

  const [height, width, channels] = imageTensor.shape;
  const srcData = imageTensor.data;
  const dstData = createTypeArray<T>(height * width * channels);

  const tempData = createTypeArray<T>(height * width * channels);
  const kernelSize = radius * 2 + 1;

  for (let y = 0; y < height; y++) {
    for (let c = 0; c < channels; c++) {
      let sum = 0;
      for (let x = -radius; x <= radius; x++) {
        const px = Math.max(0, Math.min(width - 1, x));
        sum += srcData[y * width * channels + px * channels + c];
      }

      for (let x = 0; x < width; x++) {
        tempData[y * width * channels + x * channels + c] = sum / kernelSize;

        const removeX = Math.max(0, x - radius);
        const addX = Math.min(width - 1, x + radius + 1);
        sum -= srcData[y * width * channels + removeX * channels + c];
        sum += srcData[y * width * channels + addX * channels + c];
      }
    }
  }

  for (let x = 0; x < width; x++) {
    for (let c = 0; c < channels; c++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) {
        const py = Math.max(0, Math.min(height - 1, y));
        sum += tempData[py * width * channels + x * channels + c];
      }

      for (let y = 0; y < height; y++) {
        dstData[y * width * channels + x * channels + c] = sum / kernelSize;

        const removeY = Math.max(0, y - radius);
        const addY = Math.min(height - 1, y + radius + 1);
        sum -= tempData[removeY * width * channels + x * channels + c];
        sum += tempData[addY * width * channels + x * channels + c];
      }
    }
  }

  return ndarray(dstData, [height, width, channels]);
}

function applyGaussianBlur<T extends TypedArray>(
  imageTensor: NdArray<T>,
  sigma: number
): NdArray<T> {
  if (sigma <= 0) return imageTensor;

  const radius = Math.ceil(sigma * 3);
  const kernel = createGaussianKernel(sigma, radius);
  const [height, width, channels] = imageTensor.shape;
  const srcData = imageTensor.data;
  const dstData = createTypeArray<T>(height * width * channels);
  const tempData = createTypeArray<T>(height * width * channels);

  for (let y = 0; y < height; y++) {
    for (let c = 0; c < channels; c++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const px = Math.max(0, Math.min(width - 1, x + k));
          sum += srcData[y * width * channels + px * channels + c] * kernel[k + radius];
        }
        tempData[y * width * channels + x * channels + c] = sum;
      }
    }
  }

  for (let x = 0; x < width; x++) {
    for (let c = 0; c < channels; c++) {
      for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const py = Math.max(0, Math.min(height - 1, y + k));
          sum += tempData[py * width * channels + x * channels + c] * kernel[k + radius];
        }
        dstData[y * width * channels + x * channels + c] = sum;
      }
    }
  }

  return ndarray(dstData, [height, width, channels]);
}

function applySmoothMask<T extends TypedArray>(
  mask: NdArray<T>,
  smoothness: number
): NdArray<T> {
  if (smoothness <= 0) return mask;
  return applyGaussianBlur(mask, smoothness);
}

function applyFeatherMask<T extends TypedArray>(
  mask: NdArray<T>,
  featherRadius: number
): NdArray<T> {
  if (featherRadius <= 0) return mask;

  const [height, width, channels] = mask.shape;
  const temp = ndarray(new Uint8Array(height * width), [height, width]);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      temp.data[y * width + x] = mask.data[y * width * channels];
    }
  }

  const eroded = applyErosion(temp, featherRadius);
  const dilated = applyDilation(temp, featherRadius);

  const result = createTypeArray<T>(height * width * channels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const original = temp.data[y * width + x];
      const erodeVal = eroded.data[y * width + x];
      const dilateVal = dilated.data[y * width + x];

      let alpha: number;
      if (erodeVal === dilateVal) {
        alpha = original;
      } else {
        const dist = (original - erodeVal) / (dilateVal - erodeVal || 1);
        alpha = erodeVal + dist * (dilateVal - erodeVal);
      }

      result[y * width * channels] = alpha;
    }
  }

  return ndarray(result, [height, width, channels]);
}

function applyErosion<T extends TypedArray>(
  imageTensor: NdArray<T>,
  radius: number
): NdArray<T> {
  if (radius <= 0) return imageTensor;

  const [height, width, channels] = imageTensor.shape;
  const srcData = imageTensor.data;
  const dstData = createTypeArray<T>(height * width * channels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < channels; c++) {
        let minVal = 255;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const ny = Math.max(0, Math.min(height - 1, y + dy));
            const nx = Math.max(0, Math.min(width - 1, x + dx));
            const val = srcData[ny * width * channels + nx * channels + c];
            minVal = Math.min(minVal, val);
          }
        }

        dstData[y * width * channels + x * channels + c] = minVal;
      }
    }
  }

  return ndarray(dstData, [height, width, channels]);
}

function applyDilation<T extends TypedArray>(
  imageTensor: NdArray<T>,
  radius: number
): NdArray<T> {
  if (radius <= 0) return imageTensor;

  const [height, width, channels] = imageTensor.shape;
  const srcData = imageTensor.data;
  const dstData = createTypeArray<T>(height * width * channels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < channels; c++) {
        let maxVal = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const ny = Math.max(0, Math.min(height - 1, y + dy));
            const nx = Math.max(0, Math.min(width - 1, x + dx));
            const val = srcData[ny * width * channels + nx * channels + c];
            maxVal = Math.max(maxVal, val);
          }
        }

        dstData[y * width * channels + x * channels + c] = maxVal;
      }
    }
  }

  return ndarray(dstData, [height, width, channels]);
}

function applyContrast<T extends TypedArray>(
  imageTensor: NdArray<T>,
  contrast: number
): NdArray<T> {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const [height, width, channels] = imageTensor.shape;
  const dstData = createTypeArray<T>(height * width * channels);

  for (let i = 0; i < height * width * channels; i++) {
    const val = imageTensor.data[i];
    const adjusted = factor * (val - 128) + 128;
    dstData[i] = Math.max(0, Math.min(255, adjusted));
  }

  return ndarray(dstData, [height, width, channels]);
}

function applyThreshold<T extends TypedArray>(
  imageTensor: NdArray<T>,
  threshold: number
): NdArray<T> {
  const [height, width, channels] = imageTensor.shape;
  const dstData = createTypeArray<T>(height * width * channels);

  for (let i = 0; i < height * width * channels; i++) {
    dstData[i] = imageTensor.data[i] >= threshold ? 255 : 0;
  }

  return ndarray(dstData, [height, width, channels]);
}

function applyEdgeMode<T extends TypedArray>(
  mask: NdArray<T>,
  edgeMode: 'hard' | 'soft' | 'blur' | 'auto'
): NdArray<T> {
  switch (edgeMode) {
    case 'hard':
      return applyThreshold(mask, 128);
    case 'soft':
      return applyContrast(mask, 50);
    case 'blur':
      return applyGaussianBlur(mask, 2);
    case 'auto':
    default:
      return mask;
  }
}

function createCheckerboardBackground(
  width: number,
  height: number,
  tileSize: number = 16,
  color1: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 },
  color2: { r: number; g: number; b: number } = { r: 204, g: 204, b: 204 }
): NdArray<Uint8Array> {
  const data = new Uint8Array(height * width * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const tileX = Math.floor(x / tileSize);
      const tileY = Math.floor(y / tileSize);
      const isLight = (tileX + tileY) % 2 === 0;

      if (isLight) {
        data[idx] = color1.r;
        data[idx + 1] = color1.g;
        data[idx + 2] = color1.b;
      } else {
        data[idx] = color2.r;
        data[idx + 1] = color2.g;
        data[idx + 2] = color2.b;
      }
      data[idx + 3] = 255;
    }
  }

  return ndarray(data, [height, width, 4]);
}

function composeImageWithBackground(
  foreground: NdArray<Uint8Array>,
  background: NdArray<Uint8Array> | { r: number; g: number; b: number }
): NdArray<Uint8Array> {
  const [fgHeight, fgWidth, fgChannels] = foreground.shape;
  const result = ndarray(new Uint8Array(fgHeight * fgWidth * 4), [fgHeight, fgWidth, 4]);

  if ('r' in background) {
    const bgColor = background;
    for (let y = 0; y < fgHeight; y++) {
      for (let x = 0; x < fgWidth; x++) {
        const idx = (y * fgWidth + x) * 4;
        const alpha = foreground.data[idx + 3] / 255;
        const invAlpha = 1 - alpha;

        result.data[idx] = foreground.data[idx] * alpha + bgColor.r * invAlpha;
        result.data[idx + 1] = foreground.data[idx + 1] * alpha + bgColor.g * invAlpha;
        result.data[idx + 2] = foreground.data[idx + 2] * alpha + bgColor.b * invAlpha;
        result.data[idx + 3] = 255;
      }
    }
  } else {
    const bg = background;
    const [bgHeight, bgWidth] = bg.shape;
    
    for (let y = 0; y < fgHeight; y++) {
      for (let x = 0; x < fgWidth; x++) {
        const idx = (y * fgWidth + x) * 4;
        const bgX = Math.floor(x * (bgWidth / fgWidth));
        const bgY = Math.floor(y * (bgHeight / fgHeight));
        const bgIdx = (bgY * bgWidth + bgX) * 4;
        
        const alpha = foreground.data[idx + 3] / 255;
        const invAlpha = 1 - alpha;

        result.data[idx] = foreground.data[idx] * alpha + bg.data[bgIdx] * invAlpha;
        result.data[idx + 1] = foreground.data[idx + 1] * alpha + bg.data[bgIdx + 1] * invAlpha;
        result.data[idx + 2] = foreground.data[idx + 2] * alpha + bg.data[bgIdx + 2] * invAlpha;
        result.data[idx + 3] = 255;
      }
    }
  }

  return result;
}
