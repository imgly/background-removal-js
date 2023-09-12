export default main;
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { globSync } from 'glob';

// All paths are relative to the directory of this file
const BaseDir = path.resolve('.');
const DefaultOutDir = path.resolve('./dist');
const DefaultEntry = {
  mime: 'application/octet-stream',
  transform: calculateSHA256
};

async function calculateSHA256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (error) => reject(error));
  });
}

async function copyFile(sourcePath, destinationPath) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(sourcePath);
    const writeStream = fs.createWriteStream(destinationPath);

    readStream.on('error', (error) => reject(error));
    writeStream.on('error', (error) => reject(error));
    writeStream.on('finish', () => resolve());
    readStream.pipe(writeStream);
  });
}

async function linkFile(sourcePath, destinationPath) {
  return new Promise((resolve, reject) => {
    fs.symlink(sourcePath, destinationPath, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function deleteFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (error) => {
      if (error) {
        if (error.code === 'ENOENT') {
          // File doesn't exist, resolve without an error.
          resolve();
        } else {
          // Other error occurred, reject with the error.
          reject(error);
        }
      } else {
        // File deleted successfully.
        resolve();
      }
    });
  });
}

function isFileHidden(filePath) {
  const fileName = path.basename(filePath);
  return fileName.startsWith('.'); // || isHiddenOnWindows(filePath);
}

async function listAllFiles(dir) {
  return new Promise((resolve, reject) => {
    const allFiles = [];

    function traverse(currentDir) {
      fs.readdirSync(currentDir).forEach((file) => {
        const filePath = path.join(currentDir, file);
        const stat = fs.statSync(filePath);

        if (stat.isFile()) {
          allFiles.push(filePath);
        } else if (stat.isDirectory()) {
          traverse(filePath);
        }
      });
    }

    try {
      traverse(dir);
      resolve(allFiles);
    } catch (error) {
      reject(error);
    }
  });
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

async function sizeFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (error, stats) => {
      if (error) {
        reject(error);
      } else {
        resolve(stats.size);
      }
    });
  });
}

function isFunction(variable) {
  return typeof variable === 'function';
}

async function transform(fileName, entry) {
  // console.log(entry)
  const fileHash = await entry.transform(fileName);
  const fileSize = await sizeFile(fileName);
  const destFile = path.resolve(DefaultOutDir, fileHash);
  await deleteFile(destFile);
  await copyFile(fileName, destFile);
  const chunks = {};
  chunks[fileHash] = { range: [0, fileSize - 1] };
  return {
    chunks: chunks,
    size: fileSize,
    mime: entry.mime
  };
}

async function loadConfig() {
  if (fileExists(path.resolve(BaseDir, '.resources.mjs'))) {
    const resources = await import(path.resolve(BaseDir, '.resources.mjs'));
    const entries = resources.default;
    return entries;
  }
  return { files };
}

async function main() {
  fs.mkdirSync(DefaultOutDir, { recursive: true });
  const resources = await generateFiles();

  await saveResourceMetadata(resources);
}

async function generateFiles() {
  const filesToProcess = {};
  const entries = await loadConfig();
  for (const entry of entries) {
    const entryPath = path.resolve(BaseDir, entry.source);
    const candidates = await globSync(entryPath, { nodir: true });
    if (candidates.length === 0) {
      console.error(`No files found for ${entry.source}`);
      process.exit(-1);
    }

    for (const candidate of candidates) {
      filesToProcess[candidate] = { ...DefaultEntry, ...entry };
    }
  }
  return filesToProcess;
}
async function loadResourceMetadata() {
  const resourceMetadataFile = path.resolve(DefaultOutDir, 'resources.json');
  if (fileExists(resourceMetadataFile)) {
    return JSON.parse(fs.readFileSync(resourceMetadataFile, 'utf8'));
  }
  return [];
}
async function saveResourceMetadata(filesToProcess) {
  const resourcesMetadata = {};
  for (const fileToProcess of Object.keys(filesToProcess)) {
    const entry = filesToProcess[fileToProcess];
    const metadata = await transform(fileToProcess, entry, DefaultOutDir);
    const key = path.join(entry.path, fileToProcess.split('/').pop());
    resourcesMetadata[key] = metadata;
  }
  fs.writeFileSync(
    path.resolve(DefaultOutDir, 'resources.json'),
    JSON.stringify(resourcesMetadata, null, 2)
  );
}

main(process.argv);
