import type { Config } from '@imgly/background-removal';

const partial: Config = {
  model: 'small',
  output: { quality: 0.75 }
};

const withProgress: Config = {
  progress(key, current, total) {
    key.startsWith('fetch:');
    current.toFixed(0);
    total.toFixed(0);
  }
};

const empty: Config = {};
withProgress.progress?.('fetch:example', 1, 2);
// @ts-expect-error All three callback arguments are required.
withProgress.progress?.('fetch:example');
// @ts-expect-error Unsupported model names are not part of the public input.
const unsupported: Config = { model: 'unsupported' };
