export { imageEncode, imageDecode, MimeType };
import { imageBitmapToImageData, createCanvas } from './utils';
import ndarray, { NdArray } from 'ndarray';

async function imageDecode(blob: Blob): Promise<NdArray<Uint8Array>> {
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
    case 'application/octet-stream': // this is an unknwon type
    case `image/png`:
    case `image/jpeg`:
    case `image/jpg`:
    case `image/webp`: {
      const imageBitmap = await createImageBitmap(blob);
      const imageData = imageBitmapToImageData(imageBitmap);
      return ndarray(new Uint8Array(imageData.data), [
        imageData.height,
        imageData.width,
        4
      ]);
    }
    default:
      throw new Error(
        `Invalid format: ${mime.type} with params: ${mime.params}`
      );
  }
}

async function imageEncode(
  imageTensor: NdArray<Uint8Array>,
  quality: number = 0.8,
  format: string = 'image/png'
): Promise<Blob> {
  const [height, width, channels] = imageTensor.shape;

  switch (format) {
    case 'image/x-alpha8':
    case 'image/x-rgba8': {
      const mime = MimeType.create(format, {
        width: width.toString(),
        height: height.toString()
      });
      return new Blob([imageTensor.data], { type: mime.toString() });
    }
    case `image/png`:
    case `image/jpeg`:
    case `image/webp`: {
      const imageData = new ImageData(
        new Uint8ClampedArray(imageTensor.data),
        width,
        height
      );
      var canvas = createCanvas(imageData.width, imageData.height);
      var ctx = canvas.getContext('2d')!;
      ctx.putImageData(imageData, 0, 0);
      return canvas.convertToBlob({ quality, type: format });
    }
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
