# Background Removal in the Browser

<p align="center">
<img src="https://img.ly/showcases/cesdk/web/s/case-thumbnail/background-removal/background-removal-0.png?utm_source=github&utm_medium=project&utm_campaign=bg-removal" alt="background removal js showcase" />
</p>

Remove backgrounds from images directly in the browser environment with ease and no additional costs or privacy concerns.
Explore an [interactive demo](https://img.ly/showcases/cesdk/web/background-removal/web?utm_source=github&utm_medium=project&utm_campaign=bg-removal).

## News

- **`June 28th, 2023`:** We released the code of Background Removal JS.

## Overview

`@imgly/background-removal` is a powerful npm package that allows developers to seamlessly remove the background from images directly in the browser. With its unique features and capabilities, this package offers an innovative and cost-effective solution for background removal tasks without compromising data privacy.

The key features of `@imgly/background-removal` are:

- **In-Browser Background Removal**: Our one-of-a-kind solution performs the entire background removal process directly in the user's browser, eliminating the need for additional server costs. By leveraging the computing power of the local device, users can enjoy a fast and efficient background removal process.

- **Data Protection**: As `@imgly/background-removal` runs entirely in the browser, users can have peace of mind knowing that their images and sensitive information remain secure within their own devices. With no data transfers to external servers, data privacy concerns are effectively mitigated.

- **Seamless Integration with IMG.LY's CE.SDK**: `@imgly/background-removal` provides seamless integration with [IMG.LY's CE.SDK](https://img.ly/products/creative-sdk?utm_source=github&utm_medium=project&utm_campaign=bg-removal), allowing developers to easily incorporate powerful in-browser image matting and background removal capabilities into their projects.

The Neural Network ([ONNX model](https://onnx.ai/)) and WASM files used by `@imgly/background-removal` are hosted on [UNPKG](https://www.unpkg.com/), making it readily available for download to all users of the library. See the section Custom Asset Serving if you want to host data on your own servers.

## Installation

You can install `@imgly/background-removal` via npm or yarn. Use the following commands to install the package:

### NPM

```shell
npm install @imgly/background-removal
```

## Usage

```typescript
import imglyRemoveBackground from "@imgly/background-removal"

let image_src: ImageData | ArrayBuffer | Uint8Array | Blob | URL | string = ...;

imglyRemoveBackground(image_src).then((blob: Blob) => {
  // The result is a blob encoded as PNG. It can be converted to an URL to be used as HTMLImage.src
  const url = URL.createObjectURL(blob);
})
```

Note: On the first run the wasm and onnx model files are fetched. This might, depending on the bandwidth, take time. Therefore, the first run takes proportionally longer than each consecutive run. Also, all files are cached by the browser and an additional model cache.

## Advanced Configuration

The library does not need any configuration to get started. However, there are optional parameters that influence the behaviour and give more control over the library.

```typescript
type Config = {
  publicPath: string; // The public path used for model and wasm files
  debug: bool; // enable or disable useful console.log outputs
  proxyToWorker: bool; // Whether to proxy the calculations to a web worker. (Default true)
  model: 'small' | 'medium'; // The model to use. (Default "medium")
};
```

### Download Size vs Quality

The onnx model is shipped in various sizes and needs.

- small (~40 MB) is the smallest model and is in most cases working fine but sometimes shows some artifacts. It's a quantized model.
- medium (~80MB) is the default model.

### Download Progress Monitoring

On the first run, the necessary data will be fetched and stored in the browser cache. Since the download might take some time, you have the option to tap into the download progress.

```typescript
let config: Config = {
  progress: (key, current, total) => {
    console.log(`Downloading ${key}: ${current} of ${total}`);
  }
};
```

### Performance

The performance is largely dependent on the feature set available. Most prominently, ensure that `SharedArrayBuffer` is available [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer). Due to the security requirements of `SharedArrayBuffer` two headers need to be set to cross-origin isolate your site:

```typescript
'Cross-Origin-Opener-Policy': 'same-origin',
'Cross-Origin-Embedder-Policy': 'require-corp'
```

### Custom Asset Serving

Currently, the wasm and onnx neural networks are served via unpkg. For production use, we advise you to host them yourself. Therefore, copy all .wasm and .onnx files to your public path `$PUBLIC_PATH` and reconfigure the library.

```shell
cp node_modules/@imgly/background-removal/dist/*.wasm $PUBLIC_PATH
cp node_modules/@imgly/background-removal/dist/*.onnx $PUBLIC_PATH
```

```typescript
import imglyRemoveBackground, {Config} from "@imgly/background-removal"

const public_path = "https://example.com/assets/" ; // the path assets are served from

let config: Config =  {
  publicPath: public_path, // path to the wasm files
};

let image_src: ImageData | ArrayBuffer | Uint8Array | Blob | URL | string = ...;

imglyRemoveBackground(image_src, config).then((blob: Blob) => {
  // result is a blob encoded as PNG.
  // It can be converted to an URL to be used as HTMLImage.src
  const url = URL.createObjectURL(blob);
})
```

### Debug Outputs

Enable debug outputs and logging to the console

```typescript
let config: Config = {
  debug: true
};
```

### Cross-Origin Resource Sharing (CORS)

If you are running into CORS issues you might want to pass additional parameters to the fetch function via

```typescript
let config: Config = {
  fetchArgs: {
    mode: 'no-cors'
  }
};
```

`fetchArgs` are passed as second parameters to the fetch function as described in [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch).

## Who is it for?

`@imgly/background-removal` is ideal for developers and projects that require efficient and cost-effective background removal directly in the browser. It caters to a wide range of use cases, including but not limited to:

- _E-commerce applications_ that need to remove backgrounds from product images in real time.

- _Image editing applications_ that require background removal capabilities for enhancing user experience.

- _Web-based graphic design tools_ that aim to simplify the creative process with in-browser background removal.

Whether you are a professional developer or a hobbyist, `@imgly/background-removal` empowers you to deliver impressive applications and services with ease.

## License

The software is free for use under the GPL License. Please contact [support@img.ly](mailto:support@img.ly?subject=Background-Removal%20License) for questions about other licensing options.

## Authors & Contributors

This library is made by IMG.LY shipping the world's premier SDKs for building creative applications.
Start your trial of the [CreativeEditor SDK](https://img.ly/products/creative-sdk?utm_source=github&utm_medium=project&utm_campaign=bg-removal), [PhotoEditor SDK](https://img.ly/products/photo-sdk?utm_source=github&utm_medium=project&utm_campaign=bg-removal) & [VideoEditor SDK](https://img.ly/products/video-sdk?utm_source=github&utm_medium=project&utm_campaign=bg-removal).
