export { configs };
import * as esbuild from 'esbuild';
import pkg from '../package.json' assert { type: 'json' };

const dependencies = Object.keys(pkg.dependencies);

const configs = [
  {
    entryPoints: ['src/index.ts'],
    bundle: true,
    sourcemap: true,
    platform: 'node',
    format: 'cjs',
    external: dependencies,
    outfile: 'dist/index.cjs'
  },

  {
    entryPoints: ['src/index.ts'],
    bundle: true,
    sourcemap: true,
    external: dependencies,
    platform: 'node',
    format: 'esm',
    outfile: 'dist/index.mjs'
  }
];

await configs.map(async (config) => await esbuild.build(config));
