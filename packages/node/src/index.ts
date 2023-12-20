// Exports
export default removeBackground;
export type { ImageSource, Config };
export { removeBackground };

// Imports
import { initInference, runInference } from './inference';
import { Config } from './schema';
import * as utils from './utils';
import { ImageSource } from './utils';
import lodash from 'lodash';

const { memoize } = lodash;
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
  }

  image = await utils.imageSourceToImageData(image, config);

  const outImageTensor = await runInference(image, config, session);
  return await utils.imageEncode(
    outImageTensor,
    config.output.quality,
    config.output.format
  );
}
