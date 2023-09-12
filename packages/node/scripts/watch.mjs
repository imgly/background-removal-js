import * as esbuild from 'esbuild';
import { configs } from './build.mjs';
import dts from 'npm-dts';

new dts.Generator({
  entry: 'src/index.ts',
  output: 'dist/index.d.ts'
}).generate();

const contexts = await Promise.all(
  configs.map((config) => esbuild.context(config))
);

await Promise.any(contexts.map((ctx) => ctx.watch()));
console.log('watching...');
