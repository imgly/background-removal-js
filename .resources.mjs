export default [
  {
    path: './bundle/models/*',
    mime: 'application/octet-steam',
    folder: 'models'
  },
  {
    path: './node_modules/onnxruntime-web/dist/*.wasm',
    mime: 'application/wasm',
    folder: 'vendor/onnxruntime-web/dist'
  }
];
