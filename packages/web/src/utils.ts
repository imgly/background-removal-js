export {
  imageDecode,
  imageEncode,
  tensorResize,
  tensorHWCtoBCHW,
  imageBitmapToImageData,
  calculateProportionalSize
};

import ndarray, { NdArray } from 'ndarray';
import { imageDecode, imageEncode } from './codecs';

function imageBitmapToImageData(imageBitmap: ImageBitmap): ImageData {
  var canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  var ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageBitmap, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function tensorResize(
  imageTensor: NdArray<Uint8Array>,
  newWidth: number,
  newHeight: number
): Promise<NdArray<Uint8Array>> {
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
      for (let c = 0; c < srcChannels; c++) {
        const srcX = x * scaleX;
        const srcY = y * scaleY;
        const x1 = Math.floor(srcX);
        const x2 = Math.ceil(srcX);
        const y1 = Math.floor(srcY);
        const y2 = Math.ceil(srcY);

        const dx = srcX - x1;
        const dy = srcY - y1;

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

// async function tensorResize(
//   imageTensor: NdArray<Uint8Array>,
//   newWidth: number,
//   newHeight: number
// ): Promise<NdArray<Uint8Array>> {
//   const [srcHeight, srcWidth, srcChannels] = imageTensor.shape;
//   const imageData = new ImageData(imageTensor.data, srcWidth, srcHeight);
//   const bitmap = await createImageBitmap(imageData, {
//     resizeWidth: newWidth,
//     resizeHeight: newHeight,
//     resizeQuality: 'high',
//     premultiplyAlpha: 'premultiply'
//   });
//   const outImageData = imageBitmapToImageData(bitmap);
//   return ndarray(outImageData.data, [
//     outImageData.height,
//     outImageData.width,
//     4
//   ]);
// }

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
