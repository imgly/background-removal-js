export { imageEncode, imageDecode };
import { imageBitmapToImageData } from './utils';

async function imageDecode(blob: Blob): Promise<ImageData> {
  const imageBitmap = await createImageBitmap(blob);
  const imageData = imageBitmapToImageData(imageBitmap);
  return imageData;
}

async function imageEncode(
  imageData: ImageData,
  quality: number = 0.8,
  type: string = 'image/png'
): Promise<Blob> {
  var canvas = new OffscreenCanvas(imageData.width, imageData.height);
  var ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas.convertToBlob({ quality, type });
}
