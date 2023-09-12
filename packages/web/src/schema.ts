export { ApiFunctionSchrema, type Config };

import { z } from 'zod';

import pkg from '../package.json';

const ConfigSchema = z
  .object({
    publicPath: z
      .string()
      .optional()
      .describe('The public path to the wasm files and the onnx model.')
      .default(`https://unpkg.com/${pkg.name}@${pkg.version}/dist/`),
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


const ImageSourceSchema = z.instanceof(ImageData).or(z.instanceof(ArrayBuffer)).or(z.instanceof(Uint8Array)).or(z.instanceof(Blob)).or(z.instanceof(URL)).or(z.string())
const ApiFunctionSchrema = z.function().args(ImageSourceSchema, ConfigSchema).returns(z.promise(z.instanceof(Blob)));

type Config = z.infer<typeof ConfigSchema>;

