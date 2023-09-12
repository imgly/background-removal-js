export { imageEncode, imageDecode };

import sharp, { FormatEnum } from 'sharp';
import ndarray, { NdArray } from 'ndarray';

async function imageDecode(blob: Blob): Promise<NdArray<Uint8Array>> {
  const buffer = await blob.arrayBuffer();
  const decoded = sharp(buffer);

  let { width, height, channels } = await decoded.metadata();

  if (channels === 3) {
    decoded.ensureAlpha();
    channels = 4;
  }

  const outBuffer = await decoded.raw().toBuffer();
  const array = ndarray(outBuffer, [height!, width!, channels!]);
  await sharp(array.data, {
    raw: { width: width!, height: height!, channels: channels! }
  });
  return array;
}

async function imageEncode(
  imageData: NdArray<Uint8Array>,
  quality: number = 0.8,
  type: string = 'image/png'
): Promise<Blob> {
  const [height, width, channels] = imageData.shape;
  if (channels !== 4) throw new Error('Only 4-channel images are supported');
  const image = sharp(imageData.data, { raw: { height, width, channels } });
  type Keys = keyof FormatEnum;
  const format = type.split('/').pop()! as Keys;

  const buffer = await image
    .toFormat(format, { quality: quality * 100 })
    .toBuffer();
  return new Blob([buffer], { type: type });
}
