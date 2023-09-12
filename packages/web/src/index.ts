// Imports
import { initInference, runInference } from './inference';
import { Config, ApiFunctionSchrema } from './schema';
import * as utils from './utils';
import { NdArray } from 'ndarray';
import * as codecs from './codecs';
import { memoize } from 'lodash';
import { ensureAbsoluteURI } from './url';
import { ZodError } from 'zod';

type ImageSource = ImageData | ArrayBuffer | Uint8Array | Blob | URL | string;

const init = memoize(initInference, (config) => JSON.stringify(config));

// https://www.rfc-editor.org/rfc/rfc7807

//  application/problem+json
/**
 * 
   {
    "type": "https://example.com/probs/out-of-credit",
    "title": "You do not have enough credit.",
    "detail": "Your current balance is 30, but that costs 50.",
    "instance": "/account/12345/msgs/abc",
    "balance": 30,
    "accounts": ["/account/12345",
                 "/account/67890"]
   }
 */

class Rfc7807Error extends Error {
  title: string;
  status: number;
  detail: string;
  instance: string;
  params?: [{ path: string, reason: string }]
}

class UbqError extends Error {
  title: string;
  status: number;
  detail: string;
  instance: string;
  params?: [{ path: string, reason: string }]
}
class StripeError extends Error {
  type: string;
  code: string;
  message: string 
}

class RemoveBackgroundError extends Error {
  code: "ValidationError" | "UnhandledError";
  constructor(code: string, message: string = "") {
    super()

  }
}

class ValidationError extends RemoveBackgroundError {
  constructor(message: string = "") {
    super("ValidationError", message)
  }
}

class UnhandledError extends RemoveBackgroundError {
  constructor(message: string = "") {
    super("UnhandledError", message)
  }
}


async function removeBackground(image: ImageSource, configuration: Config = {}) {
  try {
    return await ApiFunctionSchrema.strictImplement(removeBackgroundImplementation)(image, configuration);
  } catch (e) {
    if (e instanceof ZodError) {
      debugger
      for (let issue of e.issues) {

        console.log(issue.code);

        console.log(issue.argumentsError)
      }
      throw new ValidationError(e.message);
    }
    throw new UnhandledError(e.message);
  }
}

async function removeBackgroundImplementation(
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

    if (window && !window.crossOriginIsolated) {
      console.debug(
        'Cross-Origin-Isolated is not enabled. Performance will be degraded. Please see  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer.'
      );
    }
  }

  image = await imageSourceToImageData(image, config);

  const outImageTensor = await runInference(image, config, session);
  return await utils.imageEncode(outImageTensor);
}

async function imageSourceToImageData(
  image: ImageSource,
  config: Config
): Promise<NdArray<Uint8Array>> {
  if (typeof image === 'string') {
    image = ensureAbsoluteURI(image, config.publicPath);
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

  return image as NdArray<Uint8Array>;
}

// Exports
export default removeBackground;
export type { ImageSource, Config };
export { removeBackground };
