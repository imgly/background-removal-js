export default [
  {
    path: '/onnxruntime-web/',
    source:
      '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm',
    mime: 'application/wasm'
  },
  {
    path: '/onnxruntime-web/',
    source:
      '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
    mime: 'application/wasm'
  },
  {
    path: '/onnxruntime-web/',
    source:
      '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs',
    mime: 'text/javascript'
  },
  {
    path: '/onnxruntime-web/',
    source:
      '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
    mime: 'text/javascript'
  },
  {
    path: '/models/',
    source: '../../bundle/models/*',
    mime: 'application/octet-steam'
  }
];
