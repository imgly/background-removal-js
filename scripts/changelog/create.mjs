// Rails filename convention from migrations
import fs from 'node:fs';
import moment from 'moment';
import path from 'node:path';

const version = 'Unreleased';
const scriptDir = path.dirname(process.argv[1]);
const templatePath = path.resolve(scriptDir, 'template.yml');
const changeLogDir = path.resolve('./changelog', `${version}`);

const name = process.argv[2];
if (!name) {
  console.error('Please provide a name for your changelog entry');
  process.exit();
}

const dateFormat = 'YYYYDDMMHHmmss';

const date = Date.now();
const prefix = moment(date).format(dateFormat);
const filename = `${prefix}-${name}.yaml`;

// do it
const outFilePath = path.resolve(changeLogDir, filename);
fs.mkdirSync(changeLogDir, { recursive: true });
fs.copyFileSync(templatePath, outFilePath);

console.info(`File ${outFilePath} has been created successfully.`);
