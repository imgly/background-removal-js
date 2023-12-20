export { ConfigSchema, Config, validateConfig };
import { z } from 'zod';
import path from 'node:path';
import pkg from '../package.json';

function isURI(s: string) {
  try {
    new URL(s);
    return true;
  } catch (err) {
    return false;
  }
}

const ConfigSchema = z
  .object({
    publicPath: z
      .string()
      .optional()
      .describe('The public path to the wasm files and the onnx model.')
      .default(`file://${path.resolve(`node_modules/${pkg.name}/dist/`)}/`)
      .transform((val) => {
        return val
          .replace('${PACKAGE_NAME}', pkg.name)
          .replace('${PACKAGE_VERSION}', pkg.version);
      })
      .refine((val) => isURI(val), {
        message: 'String must be a valid uri'
      }),
    debug: z
      .boolean()
      .default(false)
      .describe('Whether to enable debug logging.'),
    proxyToWorker: z
      .boolean()
      .default(true)
      .describe('Whether to proxy inference to a web worker.'),
    fetchArgs: z
      .any({})
      .default({})
      .describe('Arguments to pass to fetch when loading the model.'),
    progress: z
      .function()
      .args(z.string(), z.number(), z.number())
      .returns(z.void())
      .describe('Progress callback.')
      .optional(),
    model: z.enum(['small', 'medium', 'large']).default('medium'),
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
      .default({})
  })
  .default({});

type Config = z.infer<typeof ConfigSchema>;

function validateConfig(configuration?: Config): Config {
  const config = ConfigSchema.parse(configuration ?? {});
  if (config.debug) console.log('Config:', config);
  if (config.debug && !config.progress) {
    config.progress =
      config.progress ??
      ((key, current, total) => {
        console.debug(`Downloading ${key}: ${current} of ${total}`);
      });
  }
  return config;
}
