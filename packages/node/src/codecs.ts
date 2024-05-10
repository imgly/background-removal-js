export { imageEncode, imageDecode, MimeType };

import sharp, { FormatEnum } from 'sharp';
import ndarray, { NdArray } from 'ndarray';

async function imageDecode(blob: Blob): Promise<NdArray<Uint8Array>> {
  const buffer = await blob.arrayBuffer();

  const mime = MimeType.fromString(blob.type);
  switch (mime.type) {
    case 'image/x-alpha8': {
      const width = parseInt(mime.params['width']);
      const height = parseInt(mime.params['height']);
      return ndarray(new Uint8Array(await blob.arrayBuffer()), [
        height,
        width,
        1
      ]);
    }
    case 'image/x-rgba8': {
      const width = parseInt(mime.params['width']);
      const height = parseInt(mime.params['height']);
      return ndarray(new Uint8Array(await blob.arrayBuffer()), [
        height,
        width,
        4
      ]);
    }
    case 'application/octet-stream':
    case `image/png`:
    case `image/jpeg`:
    case `image/jpg`:
    case `image/webp`: {
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
    default:
      throw new Error(`Unsupported format: ${mime.type}`);
  }
}

async function imageEncode(
  imageTensor: NdArray<Uint8Array>,
  quality: number = 0.8,
  type: string = 'image/png'
): Promise<Blob> {
  const [height, width, channels] = imageTensor.shape;
  if (channels !== 4) throw new Error('Only 4-channel images are supported');
  const image = sharp(imageTensor.data, { raw: { height, width, channels } });
  type Keys = keyof FormatEnum;

  switch (type) {
    case 'image/x-alpha8':
    case 'image/x-rgba8': {
      const mime = MimeType.create(type, {
        width: width.toString(),
        height: height.toString()
      });
      return new Blob([imageTensor.data], { type: mime.toString() });
    }
    case `image/png`:
    case `image/jpeg`:
    case `image/webp`:
      const format = type.split('/').pop()! as Keys;
      const buffer = await image
        .toFormat(format, { quality: quality * 100 })
        .toBuffer();
      return new Blob([buffer], { type: type });
    default:
      throw new Error(`Invalid format: ${format}`);
  }
}

class MimeType {
  type: string = 'application/octet-stream';
  params: Record<string, string> = {};

  private constructor(type: string, params: Record<string, string>) {
    this.type = type;
    this.params = params;
  }

  toString(): string {
    const paramsStr = [];
    for (const key in this.params) {
      const value = this.params[key];
      paramsStr.push(`${key}=${value}`);
    }
    return [this.type, ...paramsStr].join(';');
  }

  static create(type, params: Record<string, string>): MimeType {
    return new MimeType(type, params);
  }

  isIdentical(other: MimeType): Boolean {
    return this.type === other.type && this.params === other.params;
  }

  isEqual(other: MimeType): Boolean {
    return this.type === other.type;
  }

  static fromString(mimeType: string): MimeType {
    const [type, ...paramsArr] = mimeType.split(';');
    const params: Record<string, string> = {};

    for (const param of paramsArr) {
      const [key, value] = param.split('=');
      params[key.trim()] = value.trim();
    }
    return new MimeType(type, params);
  }
}
