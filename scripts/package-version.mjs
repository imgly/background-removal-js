import fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';

const workspaceManifest = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const newVersion = process.argv[2] || workspaceManifest.version || undefined;

function getFiles(dir) {
  return globSync(path.join(dir, '**/package.json'), {
    nodir: true,
    ignore: ['**/node_modules/**']
  });
}

for (let file of getFiles('./')) {
  const fileContent = fs.readFileSync(file, 'utf8').toString();
  const manifest = JSON.parse(fileContent, 'utf8');

  if (newVersion && manifest.version !== newVersion) {
    console.info(
      `${manifest.name}@${manifest.version} => ${manifest.name}@${newVersion}`
    );
    manifest.version = newVersion;
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  } else {
    console.info(`${manifest.name}@${manifest.version}`);
  }
}
