export { imageEncode, imageDecode };
import { imageBitmapToImageData } from './utils';
import ndarray, { NdArray } from 'ndarray';

async function imageDecode(blob: Blob): Promise<NdArray<Uint8Array>> {
  const imageBitmap = await createImageBitmap(blob);
  const imageData = imageBitmapToImageData(imageBitmap);
  return ndarray(imageData.data, [imageData.height, imageData.width, 4]);
}

async function imageEncode(
  imageTensor: NdArray<Uint8Array>,
  quality: number = 0.8,
  type: string = 'image/png'
): Promise<Blob> {
  const [height, width, channels] = imageTensor.shape;
  const imageData = new ImageData(
    new Uint8ClampedArray(imageTensor.data),
    width,
    height
  );
  var canvas = new OffscreenCanvas(imageData.width, imageData.height);
  var ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas.convertToBlob({ quality, type });
}
