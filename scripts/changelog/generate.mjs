/**
 * https://keepachangelog.com/en/1.1.0/
 * Idea is simple we have a directory of yaml files. The subdirectory defines the version name.
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

const types = ['Infos', 'Added', 'Fixed', 'Removed', 'Changed', 'Security'];

const changeLogDir = path.resolve('./changelog');

const enumerateFilesInDirectory = (dir) => {
  return fs
    .readdirSync(dir)
    .map((entry) => {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        return fullPath;
      }
      return null;
    })
    .filter((entry) => entry !== null);
};

const enumerateDirectoriesInDirectory = (dir) => {
  return fs
    .readdirSync(dir)
    .map((entry) => {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        return entry;
      }
      return null;
    })
    .filter((entry) => entry !== null);
};

function parseChangelogItems(entries) {
  const changelog = {};
  entries.forEach((entry) => {
    const fileContent = fs.readFileSync(entry, 'utf8');
    const changelogItems = yaml.parseAllDocuments(fileContent);
    changelogItems.forEach((document) => {
      const changelogItem = document.toJS();
      const { type = 'Infos', description } = changelogItem;

      if (changelogItem.private) return;

      if (!(type in changelog)) {
        changelog[type] = [];
      }
      const message = `${description}`;
      changelog[type].push(message);
    });
  });
  return changelog;
}

// Write file
const outFile = path.resolve('./CHANGELOG.md');
const outStream = fs.createWriteStream(outFile, { encoding: 'utf8' });

// Root entries
const entries = enumerateFilesInDirectory(changeLogDir);
const changelogItems = parseChangelogItems(entries);

outStream.write(`# Changelog\n\n`);

changelogItems['Infos']?.forEach((info) => {
  outStream.write(`${info}\n\n`);
});

const versionSorter = (a, b) => {
  return a < b ? +1 : -1;
};

const versions = enumerateDirectoriesInDirectory(changeLogDir)
  .map((directory) => path.basename(directory))
  .sort(versionSorter);

versions.forEach((version) => {
  const versionDir = path.join(changeLogDir, version);
  const entries = enumerateFilesInDirectory(versionDir);
  const changelogItems = parseChangelogItems(entries);

  const hasItems = Object.keys(changelogItems).length > 0;
  hasItems && outStream.write(`## [${version}]\n\n`);
  types.forEach((type) => {
    if (changelogItems[type]) {
      const messages = changelogItems[type];
      if (type === 'Infos') {
        messages.forEach((message) => {
          outStream.write(`${message}\n`);
        });
      } else {
        outStream.write(`### ${type}\n\n`);
        messages.forEach((message) => {
          outStream.write(`- ${message}\n`);
        });
      }
      // outStream.write(`\n`)
    }
  });
});

outStream.end();
