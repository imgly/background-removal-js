export { configs };

import * as esbuild from 'esbuild';
import dts from 'npm-dts';
import pkg from '../package.json' assert { type: 'json' };

const dependencies = Object.keys(pkg.dependencies);

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
    platform: 'browser',
    external: dependencies,
    format: 'cjs',
    outfile: 'dist/index.cjs'
  },
  {
    entryPoints: ['src/index.ts'],
    bundle: true,
    sourcemap: true,
    external: dependencies,
    platform: 'browser',
    format: 'esm',
    outfile: 'dist/index.mjs'
  }
];

await configs.map(async (config) => await esbuild.build(config));
await typings.generate();
