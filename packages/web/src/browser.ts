// Exports
export default removeBackground;
export type { ImageSource, Config };

// Imports
import { runInference } from './inference';
import { Config, validateConfig } from './schema';
import { createOnnxRuntime } from './onnx';
import * as utils from './utils';
import * as Resource from './resource';
import { Imports } from './tensor';

import { memoize } from 'lodash';

type ImageSource = ImageData | ArrayBuffer | Uint8Array | Blob | URL | string;

async function createSession(config: Config, imports: Imports) {
  if (config.debug) console.debug('Loading model...');
  const model = config.model;
  const blob = await Resource.load(`/models/${model}`, config);
  const arrayBuffer = await blob.arrayBuffer();
  const session = await imports.createSession(arrayBuffer);
  return session;
}

async function _init(config?: Config) {
  config = validateConfig(config);
  const imports = createOnnxRuntime(config);
  const session = await createSession(config, imports);
  return { config, imports, session };
}

const init = memoize(_init, (config) => JSON.stringify(config));

async function removeBackground(
  image: ImageSource,
  configuration?: Config
): Promise<Blob> {
  const { config, imports, session } = await init(configuration);

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

  const imageData = await runInference(image, config, imports, session);

  return await utils.imageEncode(imageData);
}
