export default [
  {
    path: '/models/',
    source: '../../bundle/models/*',
    mime: 'application/octet-steam'
  },
  {
    path: '/onnxruntime-web/',
    source: './node_modules/onnxruntime-web/dist/*.wasm',
    mime: 'application/wasm'
  }
];
