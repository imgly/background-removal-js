// Exports
export default removeBackground;
export type { ImageSource, Config };

// Imports
import { initInference, runInference } from './inference';
import { Config } from './schema';
import * as utils from './utils';
import ndarray from 'ndarray';
import * as codecs from './codecs';
import { memoize } from 'lodash';

type ImageSource = ImageData | ArrayBuffer | Uint8Array | Blob | URL | string;

const init = memoize(initInference, (config) => JSON.stringify(config));

async function removeBackground(
  image: ImageSource,
  configuration?: Config
): Promise<Blob> {
  const { config, session } = await init(configuration);

  if (config.debug) {
    config.progress =
      config.progress ??
      ((key, current, total) => {
        console.debug(`Downloading ${key}: ${current} of ${total}`);
      });

    if (!crossOriginIsolated) {
      console.debug(
        'Cross-Origin-Isolated is not enabled. Performance will be degraded. Please see  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer.'
      );
    }
  }

  image = await imageSourceToImageData(image);

  if (!(image instanceof ImageData)) {
    throw new Error(
      'Image not an ImageData | ArrayBuffer | Uint8Array | Blob | URL | string'
    );
  }

  const imageTensor = ndarray(image.data, [image.height, image.width, 4]);
  const outImageTensor = await runInference(imageTensor, config, session);

  const imageData = new ImageData(
    outImageTensor.data,
    outImageTensor.shape[1],
    outImageTensor.shape[0]
  );
  return await utils.imageEncode(imageData);
}

async function imageSourceToImageData(
  image: string | URL | ArrayBuffer | ImageData | Blob | Uint8Array
) {
  if (typeof image === 'string') {
    image = utils.ensureAbsoluteURL(image);
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
    image = await codecs.imageDecode(image);
  }

  return image as ImageData;
}
