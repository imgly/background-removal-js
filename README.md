# Background Removal in the Browser & Node.js

<p align="center">
<img src="https://img.ly/showcases/cesdk/web/s/case-thumbnail/background-removal/background-removal-0.png?utm_source=github&utm_medium=project&utm_campaign=bg-removal" alt="background removal js showcase" />

</p>

Remove backgrounds from images directly in the browser or Node.js environment with ease and no additional costs or privacy concerns.
Explore an [interactive demo](https://img.ly/showcases/cesdk/web/background-removal/web?utm_source=github&utm_medium=project&utm_campaign=bg-removal).

## Overview

`@imgly/background-removal` is a powerful npm package that allows developers to seamlessly remove the background from images directly in the browser.

`@imgly/background-removal-node` is a powerful npm package that allows developers to remove the background from images in Node.js.

With its unique features and capabilities, this package offers an innovative and cost-effective solution for background removal tasks without compromising data privacy.

## Getting started

Note: On the first run the wasm and onnx model files are fetched. This might, depending on the bandwidth, take time. Therefore, the first run takes proportionally longer than each consecutive run. Also, all files are cached by the browser and an additional model cache.

### Browser

- Run `npm i @imgly/background-removal` to install the package.
- Run the following code:

  ```js
  import removeBackground from '@imgly/background-removal';

  async function demoRemoveBackground(url) {
    console.log('Starting background removal');
    const imageBlob = await removeBackground(url, {
      progress: (key, current, total) => {
        const [type, subtype] = key.split(':');
        console.log(
          `${type} ${subtype} ${((current / total) * 100).toFixed(0)}%`
        );
      }
    });
    const newUrl = URL.createObjectURL(imageBlob);
    console.log('Image with background removed accessible at: ' + newUrl);
  }
  demoRemoveBackground(
    'https://images.unsplash.com/photo-1686002359940-6a51b0d64f68?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1024&q=80'
  );
  ```

  Read more about running the background removal inside the browser here: [Browser Package README.md](https://github.com/imgly/background-removal-js/blob/main/packages/web/README.md)

### Node

- Run `npm i @imgly/background-removal-node` to install the package.
- Run the following code:

  ```js
  const { removeBackground } = require('@imgly/background-removal-node');
  const fs = require('fs');

  async function demoRemoveBackground(imageUrl) {
    console.log('Removing background from: ' + imageUrl);
    const blob = await removeBackground(imageUrl, { debug: false });
    const buffer = await blob.arrayBuffer();
    try {
      await fs.promises.mkdir('tmp', { recursive: true });
      await fs.promises.writeFile('tmp/output.png', Buffer.from(buffer));
      console.log('Image saved to tmp/output.png');
    } catch (error) {
      console.error(error);
    }
  }

  demoRemoveBackground(
    'https://images.unsplash.com/photo-1686002359940-6a51b0d64f68?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1024&q=80'
    // "files/photo-1686002359940-6a51b0d64f68.jpeg",
  );
  ```

  Read more about running the background removal using NodeJS here: [NodeJS Package README.md](https://github.com/imgly/background-removal-js/blob/main/packages/node/README.md)

## Who is it for?

`@imgly/background-removal` is ideal for developers and projects that require efficient and cost-effective background removal directly in the browser or Node.js. It caters to a wide range of use cases, including but not limited to:

- _E-commerce applications_ that need to remove backgrounds from product images in real time.

- _Image editing applications_ that require background removal capabilities for enhancing user experience.

- _Web-based graphic design tools_ that aim to simplify the creative process with in-browser background removal.

Whether you are a professional developer or a hobbyist, `@imgly/background-removal` empowers you to deliver impressive applications and services with ease.

## License

The software is free for use under the GPL License. Please contact [support@img.ly](mailto:support@img.ly?subject=Background-Removal%20License) for questions about other licensing options.

## Authors & Contributors

This library is made by IMG.LY shipping the world's premier SDKs for building creative applications.
Start your trial of the [CreativeEditor SDK](https://img.ly/products/creative-sdk?utm_source=github&utm_medium=project&utm_campaign=bg-removal), [PhotoEditor SDK](https://img.ly/products/photo-sdk?utm_source=github&utm_medium=project&utm_campaign=bg-removal) & [VideoEditor SDK](https://img.ly/products/video-sdk?utm_source=github&utm_medium=project&utm_campaign=bg-removal).
