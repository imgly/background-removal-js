const {
  removeBackground,
  segmentForeground,
  applySegmentationMask
} = require('@imgly/background-removal-node');
const fs = require('fs');
const uuidv4 = require('uuid').v4;

const images = [
  // 'files/photo-1686002359940-6a51b0d64f68.jpeg',
  'files/photo-1686002359940-hires.webp'
  // 'files/photo-1590523278191-hires.webp'
  // 'https://images.unsplash.com/photo-1686002359940-6a51b0d64f68?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&q=80'
  // 'https://images.unsplash.com/photo-1590523278191-995cbcda646b?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=1080&fit=max&ixid=eyJhcHBfaWQiOjEyMDd9'
];

async function run() {
  const randomImage = images[Math.floor(Math.random() * images.length)];
  console.log('Random image: ' + randomImage);
  const config = {
    debug: false,
    // publicPath:  ...
    progress: (key, current, total) => {
      const [type, subtype] = key.split(':');
      console.log(
        `${type} ${subtype} ${((current / total) * 100).toFixed(0)}%`
      );
    },
    // model: 'small',
    model: 'isnet',
    output: {
      quality: 0.8,
      format: 'image/webp' //image/jpeg, image/webp
    }
  };
  console.time();
  const blob = await removeBackground(randomImage, config);

  // const mask = await segmentForeground(randomImage, config);
  // const blob = await applySegmentationMask(randomImage, mask, config);
  console.timeEnd();
  const buffer = await blob.arrayBuffer();
  try {
    const format = config.output.format.split('/').pop();
    const outFile = `tmp/${uuidv4()}.${format}`;
    await fs.promises.mkdir('tmp', { recursive: true });
    await fs.promises.writeFile(outFile, Buffer.from(buffer));
    console.log(`Image saved to ${outFile}`);
  } catch (error) {
    console.error(error);
  }
}

run();
