export { ConfigSchema, Config, validateConfig };

import { z } from 'zod';
import { ensureAbsoluteURL } from './utils';

const ConfigSchema = z
  .object({
    publicPath: z
      .string()
      .optional()
      .describe('The public path to the wasm files and the onnx model.')
      .transform((val) => (val ? ensureAbsoluteURL(val) : val)),
    debug: z
      .boolean()
      .default(false)
      .describe('Whether to enable debug logging.'),
    proxyToWorker: z
      .boolean()
      .default(true)
      .describe('Whether to proxy inference to a web worker.'),
    fetchArgs: z
      .object({})
      .default({})
      .describe('Arguments to pass to fetch when loading the model.'),
    progress: z
      .function()
      .args(z.string(), z.number(), z.number())
      .returns(z.undefined())
      .describe('Progress callback.')
      .optional(),
    model: z.enum(['small', 'medium']).default('medium')
  })
  .default({});

type Config = z.infer<typeof ConfigSchema>;

function validateConfig(config?: Config): Config {
  const result = ConfigSchema.parse(config ?? {});
  if (result.debug) console.log('Config:', result);
  return result;
}
