// Exports
export default removeBackground;
export type { ImageSource, Config };

// Imports
import { runInference } from './inference';
import { Config, validateConfig } from './schema';
import { createOnnxSession, runOnnxSession } from './onnx';
import * as utils from './utils';
import * as Resource from './resource';
import ndarray from 'ndarray';

import { memoize } from 'lodash';

type ImageSource = ImageData | ArrayBuffer | Uint8Array | Blob | URL | string;


async function initInference(config?: Config) {
  config = validateConfig(config);

  if (config.debug) console.debug('Loading model...');
  const model = config.model;
  const blob = await Resource.load(`/models/${model}`, config);
  const arrayBuffer = await blob.arrayBuffer();
  const session = await createOnnxSession(arrayBuffer, config);
  return { config, session };
}

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

  image = await utils.imageSourceToImageData(image);

  if (!(image instanceof ImageData)) {
    throw new Error(
      'Image not an ImageData | ArrayBuffer | Uint8Array | Blob | URL | string'
    );
  }

  const imageTensor = ndarray(image.data, [image.height, image.width, 4]);
  const outImageTensor = await runInference(imageTensor, config, session);

  const imageData = new ImageData(outImageTensor.data, outImageTensor.shape[1], outImageTensor.shape[0]);
  return await utils.imageEncode(imageData);
}
