#!/usr/bin/env node

import pkg from '../dist/index.cjs';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
const removeBackground = pkg.default; // why is this necessary

const randomImage = process.argv[2];
const outputfile = process.argv[3];

const blob = await removeBackground(randomImage, {
  publicPath: `file://${path.resolve(`dist`)}/`,
  debug: false
});
const arrayBuffer = new Uint8Array(await blob.arrayBuffer());

await writeFile(path.resolve(outputfile), arrayBuffer, 'binary');
