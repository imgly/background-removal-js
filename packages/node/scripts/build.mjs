export { configs };
import * as esbuild from 'esbuild';
import dts from 'npm-dts';

const typings = new dts.Generator(
  {
    entry: 'src/index.ts',
    output: 'dist/index.d.ts'
  },
  true,
  true
);

const configs = [
  {
    entryPoints: ['src/index.ts'],
    bundle: true,
    sourcemap: true,
    platform: 'node',
    format: 'cjs',
    external: ['sharp', 'onnxruntime-node'],
    outfile: 'dist/index.cjs'
  },

  {
    entryPoints: ['src/index.ts'],
    bundle: true,
    sourcemap: true,
    external: ['sharp', 'onnxruntime-node'],
    platform: 'node',
    format: 'esm',
    outfile: 'dist/index.mjs'
  }
];

await configs.map(async (config) => await esbuild.build(config));
await typings.generate();
