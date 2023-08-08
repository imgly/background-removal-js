import { removeBackground } from '@imgly/background-removal-node';
import fs from 'fs';

const images = [
  'files/photo-1686002359940-6a51b0d64f68.jpeg',
  'https://images.unsplash.com/photo-1686002359940-6a51b0d64f68?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1024&q=80',
  'https://images.unsplash.com/photo-1590523278191-995cbcda646b?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=1080&fit=max&ixid=eyJhcHBfaWQiOjEyMDd9'
];

async function run() {
  const randomImage = images[Math.floor(Math.random() * images.length)];
  console.log('Random image: ' + randomImage);
  const blob = await removeBackground(randomImage, { debug: false });
  const buffer = await blob.arrayBuffer();
  try {
    await fs.promises.mkdir('tmp', { recursive: true });
    await fs.promises.writeFile('tmp/output.png', Buffer.from(buffer));
    console.log('Image saved to tmp/output.png');
  } catch (error) {
    console.error(error);
  }
}

run();
