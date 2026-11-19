import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const { name, version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);
const bundle = await build({
  entryPoints: ['src/schema.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node'
});
const { validateConfig } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(bundle.outputFiles[0].contents).toString('base64')
);

test('defaults and URL tokens are normalized before use', () => {
  const defaults = validateConfig();
  assert.equal(
    defaults.publicPath,
    `https://staticimgly.com/@imgly/background-removal-data/${version}/dist/`
  );
  assert.equal(defaults.model, 'isnet_fp16');
  assert.deepEqual(defaults.output, { format: 'image/png', quality: 0.8 });
  assert.deepEqual(defaults.fetchArgs, {});
  assert.equal(
    validateConfig({
      publicPath: 'https://assets.example/${PACKAGE_NAME}/${PACKAGE_VERSION}/',
      output: { format: 'image/webp' }
    }).publicPath,
    `https://assets.example/${name}/${version}/`
  );
  assert.deepEqual(validateConfig({ output: { format: 'image/webp' } }).output, {
    format: 'image/webp',
    quality: 0.8
  });
});

test('legacy model names and callback argument validation still work', () => {
  assert.equal(validateConfig({ model: 'large' }).model, 'isnet');
  assert.equal(validateConfig({ model: 'medium' }).model, 'isnet_fp16');
  assert.equal(validateConfig({ model: 'small' }).model, 'isnet_quint8');
  assert.throws(() => validateConfig({ model: 'unsupported' }));
  assert.throws(() => validateConfig({ progress: 'not a callback' }));
  const calls = [];
  const config = validateConfig({
    progress(...args) {
      calls.push(args);
    }
  });
  config.progress('model', 2, 4);
  assert.deepEqual(calls, [['model', 2, 4]]);
  assert.throws(() => config.progress('model', '2', 4));
  assert.deepEqual(calls, [['model', 2, 4]]);
});
