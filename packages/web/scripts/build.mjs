export { configs };

import * as esbuild from 'esbuild';
import dts from 'npm-dts';

new dts.Generator({
  entry: 'src/index.ts',
  output: 'dist/index.d.ts'
}).generate();

const configs = [
  {
    entryPoints: ['src/index.ts'],
    bundle: true,
    sourcemap: true,
    platform: 'browser',
    external: ['onnxruntime-web'],
    format: 'cjs',
    outfile: 'dist/index.cjs'
  },
  {
    entryPoints: ['src/index.ts'],
    bundle: true,
    sourcemap: true,
    external: ['onnxruntime-web'],
    platform: 'browser',
    format: 'esm',
    outfile: 'dist/index.mjs'
  }
];

await configs.map(async (config) => await esbuild.build(config));
