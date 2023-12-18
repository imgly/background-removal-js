// Exports
export default removeBackground;
export type { ImageSource, Config };
export { removeBackground, preload };

// Imports
import { initInference, runInference } from './inference';
import { Config, validateConfig } from './schema';
import * as utils from './utils';
import { ImageSource } from './utils';
import { memoize } from 'lodash';

import { preload as preloadResources } from './resource';

const init = memoize(initInference, (config) => JSON.stringify(config));

async function preload(configuration?: Config): Promise<void> {
  const config = validateConfig(configuration);
  await preloadResources(config);
  return;
}
async function removeBackground(
  image: ImageSource,
  configuration?: Config
): Promise<Blob> {
  const { config, session } = await init(configuration);

  image = await utils.imageSourceToImageData(image, config);

  const outImageTensor = await runInference(image, config, session);
  return await utils.imageEncode(
    outImageTensor,
    config.output.quality,
    config.output.format
  );
}
