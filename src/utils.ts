export {
  imageDecode,
  imageEncode,
  imageBitmapToImageData,
  imageDataResize,
  imageDataToFloat32Array,
  calculateProportionalSize,
  isAbsoluteURL,
  ensureAbsoluteURL,
  imageSourceToImageData
};

function createCanvas() {
  return document.createElement('canvas');
}

async function imageDecode(blob: Blob): Promise<ImageData> {
  const imageBitmap = await createImageBitmap(blob);
  const imageData = imageBitmapToImageData(imageBitmap);
  return imageData;
}

async function imageEncode(
  imagedata: ImageData,
  quality: number = 0.8
): Promise<Blob> {
  var canvas = createCanvas();
  var ctx = canvas.getContext('2d')!;
  canvas.width = imagedata.width;
  canvas.height = imagedata.height;
  ctx.putImageData(imagedata, 0, 0);
  return new Promise((resolve, _reject) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob!);
      },
      'image/png',
      quality
    );
  });
}

function imageBitmapToImageData(imageBitmap: ImageBitmap): ImageData {
  const canvas = createCanvas();
  const ctx = canvas.getContext('2d')!;

  // Set the canvas dimensions to match the ImageBitmap
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;

  // Draw the ImageBitmap onto the canvas
  ctx.drawImage(imageBitmap, 0, 0);

  // Retrieve the ImageData from the canvas
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function imageDataResize(
  imageData: ImageData,
  newWidth: number,
  newHeight: number
): Promise<ImageData> {
  const bitmap = await createImageBitmap(imageData, {
    resizeWidth: newWidth,
    resizeHeight: newHeight,
    resizeQuality: 'high',
    premultiplyAlpha: 'premultiply'
  });
  return imageBitmapToImageData(bitmap);
}

function imageDataToFloat32Array(image: ImageData): Float32Array {
  var imageBufferData = image.data;

  const stride = image.width * image.height;
  const float32Data = new Float32Array(3 * stride);

  // r_0, r_1, .... g_0,g_1, .... b_0
  for (let i = 0, j = 0; i < imageBufferData.length; i += 4, j += 1) {
    float32Data[j] = imageBufferData[i] / 255.0 - 0.5;
    float32Data[j + stride] = imageBufferData[i + 1] / 255.0 - 0.5;
    float32Data[j + stride + stride] = imageBufferData[i + 2] / 255.0 - 0.5;
  }

  return float32Data;
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

async function imageSourceToImageData(
  image: string | URL | ArrayBuffer | ImageData | Blob | Uint8Array
) {
  if (typeof image === 'string') {
    image = ensureAbsoluteURL(image);
    image = new URL(image);
  }
  if (image instanceof URL) {
    const response = await fetch(image, {});
    image = await response.blob();
  }
  if (image instanceof ArrayBuffer) {
    image = new Blob([image]);
  }
  if (image instanceof Uint8Array) {
    image = new Blob([image]);
  }
  if (image instanceof Blob) {
    image = await imageDecode(image);
  }

  return image as ImageData;
}
