export { Config, ConfigSchema, validateConfig };

import { z } from 'zod';

import pkg from '../package.json';

const ConfigSchema = z
  .object({
    publicPath: z
      .string()
      .optional()
      .describe('The public path to the wasm files and the onnx model.')
      .default(
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
      .function()
      .args(z.string(), z.number(), z.number())
      .returns(z.void())
      .describe('Progress callback.')
      .optional(),
    model: z
      .preprocess(
        (val) => {
          switch (val) {
            case 'large':
              return 'isnet';
            case 'small':
              return 'isnet_quint8';
            case 'medium':
              return 'isnet_fp16';
            default:
              return val;
          }
        },
        z.enum(['isnet', 'isnet_fp16', 'isnet_quint8'])
      )
      .default('medium'),
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
      .default({}),
    mask: z
      .object({
        smoothness: z
          .number()
          .min(0)
          .max(20)
          .default(0)
          .describe('Smoothness of the mask edges (0-20, higher = smoother).'),
        feather: z
          .number()
          .min(0)
          .max(50)
          .default(0)
          .describe('Feather radius for soft edges (0-50 pixels).'),
        edgeMode: z
          .enum(['auto', 'hard', 'soft', 'blur'])
          .default('auto')
          .describe('Edge processing mode.'),
        contrast: z
          .number()
          .min(-100)
          .max(100)
          .default(0)
          .describe('Contrast adjustment for the mask (-100 to 100).'),
        threshold: z
          .number()
          .min(0)
          .max(255)
          .optional()
          .describe('Threshold value for binary mask (0-255).')
      })
      .default({}),
    background: z
      .object({
        type: z
          .enum(['transparent', 'solid', 'image', 'checkerboard'])
          .default('transparent')
          .describe('Background type.'),
        color: z
          .object({
            r: z.number().min(0).max(255).default(255),
            g: z.number().min(0).max(255).default(255),
            b: z.number().min(0).max(255).default(255)
          })
          .default({}),
        image: z
          .any()
          .optional()
          .describe('Background image source (ImageSource).'),
        checkerboard: z
          .object({
            tileSize: z.number().min(4).max(64).default(16),
            color1: z
              .object({
                r: z.number().min(0).max(255).default(255),
                g: z.number().min(0).max(255).default(255),
                b: z.number().min(0).max(255).default(255)
              })
              .default({}),
            color2: z
              .object({
                r: z.number().min(0).max(255).default(204),
                g: z.number().min(0).max(255).default(204),
                b: z.number().min(0).max(255).default(204)
              })
              .default({})
          })
          .default({})
      })
      .default({})
  })
  .default({})
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

type Config = z.infer<typeof ConfigSchema>;

function validateConfig(configuration?: Config): Config {
  return ConfigSchema.parse(configuration ?? {});
}
