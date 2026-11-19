export { Config, ConfigSchema, InternalConfig, validateConfig };

import { z } from 'zod';

import pkg from '../package.json';

type Progress = (key: string, current: number, total: number) => void;

const progressSignature = z.function({
  input: [z.string(), z.number(), z.number()],
  output: z.void()
});

const ConfigSchema = z
  .object({
    publicPath: z
      .string()
      .optional()
      .describe('The public path to the wasm files and the onnx model.')
      .prefault(
        'https://staticimgly.com/@imgly/background-removal-data/${PACKAGE_VERSION}/dist/'
      )
      .transform((val) => {
        return val
          .replace('${PACKAGE_NAME}', pkg.name)
          .replace('${PACKAGE_VERSION}', pkg.version);
      }),
    debug: z
      .boolean()
      .default(false)
      .describe('Whether to enable debug logging.'),
    rescale: z
      .boolean()
      .default(true)
      .describe('Whether to rescale the image.'),
    device: z
      .enum(['cpu', 'gpu'])
      .default('cpu')
      .describe('The device to run the model on.'),
    proxyToWorker: z
      .boolean()
      .default(false)
      .describe('Whether to proxy inference to a web worker.'),
    fetchArgs: z
      .any()
      .default({})
      .describe('Arguments to pass to fetch when loading the model.'),
    progress: z
      .custom<Progress>((value) => typeof value === 'function')
      .transform((callback): Progress => progressSignature.implement(callback))
      .describe('Progress callback.')
      .optional(),
    model: z
      .enum(['isnet', 'isnet_fp16', 'isnet_quint8', 'large', 'medium', 'small'])
      .transform((model) => {
        switch (model) {
          case 'large':
            return 'isnet';
          case 'medium':
            return 'isnet_fp16';
          case 'small':
            return 'isnet_quint8';
          default:
            return model;
        }
      })
      .default('isnet_fp16'),
    output: z
      .object({
        format: z
          .enum([
            'image/png',
            'image/jpeg',
            'image/webp',
            'image/x-rgba8',
            'image/x-alpha8'
          ])
          .default('image/png'),
        quality: z.number().default(0.8)
      })
      .prefault({})
  })
  .prefault({})
  .transform((config) => {
    if (config.debug) console.log('Config:', config);
    if (config.debug && !config.progress) {
      config.progress =
        config.progress ??
        ((key, current, total) => {
          console.debug(`Downloading ${key}: ${current} of ${total}`);
        });

      if (!crossOriginIsolated) {
        if (config.debug)
          console.debug(
            'Cross-Origin-Isolated is not enabled. Performance will be degraded. Please see  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer.'
          );
      }
    }

    return config;
  });

type Config = z.input<typeof ConfigSchema>;
type InternalConfig = z.output<typeof ConfigSchema>;

function validateConfig(configuration?: Config): InternalConfig {
  return ConfigSchema.parse(configuration ?? {});
}
