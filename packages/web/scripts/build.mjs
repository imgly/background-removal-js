export { configs };

import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const pkg = JSON.parse(
  readFileSync(path.join(fileURLToPath(import.meta.url), '..', 'package.json'))
);

const dependencies = [Object.keys(pkg.peerDependencies)].flat();

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
