// Exports
export default removeBackground;
export type { ImageSource, Config };

// Imports
import { runInference } from './inference';
import { Config, validateConfig } from './schema';

import { createOnnxRuntime } from './ort-web-rt';
import * as utils from './utils';
import { memoize } from 'lodash';

type ImageSource = ImageData | ArrayBuffer | Uint8Array | Blob | URL | string;

const memoizedCreateOnnxRuntime = memoize(createOnnxRuntime);

async function removeBackground(
  image: ImageSource,
  config?: Config
): Promise<Blob> {
  config = validateConfig(config);

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

  const imports = memoizedCreateOnnxRuntime(config);

  image = await utils.imageSourceToImageData(image);

  if (!(image instanceof ImageData)) {
    throw new Error(
      'Image not an ImageData | ArrayBuffer | Uint8Array | Blob | URL | string'
    );
  }

  const imageData = await runInference(image, config, imports);

  return await utils.imageEncode(imageData);
}
