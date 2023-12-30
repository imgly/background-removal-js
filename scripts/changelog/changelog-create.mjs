#!/usr/bin/env node
// Rails filename convention from migrations
import moment from 'moment';
import ejs from 'ejs';
import meow from 'meow';

import fs from 'node:fs';
import path from 'node:path';

const AllowedTypes = ['Added', 'Changed', 'Removed', 'Security'];

const scriptName = process.argv[1].split(path.sep).pop();
const cli = meow(
  `
    Usage
      $ ${scriptName} <message>

    Options
      --message, -m  Message for the changelog entry
      --type, -t     Type of the changelog entry (Allowed types: ${AllowedTypes.join(
        ', '
      )})
      --version, -v  Show version number
      --help, -h     Display this message
    Examples
      $ ${scriptName} Message
      $ ${scriptName} --message "Message"
      $ ${scriptName} -m "Changelog Message"
      $ ${scriptName} -type "Added"
      $ ${scriptName} --help
`,
  {
    importMeta: import.meta,
    flags: {
      message: {
        type: 'string',
        shortFlag: 'm'
      },
      version: {
        type: 'boolean',
        shortFlag: 'v'
      },
      help: {
        type: 'boolean',
        shortFlag: 'h'
      },
      type: {
        type: 'string',
        shortFlag: 't',
        default: 'Added'
      }
    }
  }
);

if (cli.flags.help) {
  cli.showHelp();
  process.exit();
}
if (cli.flags.version) {
  console.log('1.0.0');
  process.exit();
}

if (!AllowedTypes.includes(cli.flags.type)) {
  console.error(`Invalid type: ${cli.flags.type}`);
  console.error(`Allowed types are: ${AllowedTypes.join(', ')}`);
  cli.showHelp();
  process.exit(1);
}

const version = 'Unreleased';
const type = cli.flags.type;
const scriptDir = path.dirname(process.argv[1]);
const templatePath = path.resolve(scriptDir, 'template.yml.ejs');
const changeLogDir = path.resolve('./changelog', `${version}`);

const message = cli.flags.message || cli.input.join(' ');
if (!message) {
  cli.showHelp();
  process.exit();
}

const name = message.replace(/(\W+)/gi, '_');

const dateFormat = 'YYYYDDMMHHmmss';

const date = Date.now();
const prefix = moment(date).format(dateFormat);
const filename = `${prefix}-${name}.yaml`;
// do it
const outFilePath = path.resolve(changeLogDir, filename);
fs.mkdirSync(changeLogDir, { recursive: true });

const template = fs.readFileSync(templatePath, 'utf-8');
const data = { message, type };
const renderedTemplate = ejs.render(template, data);

fs.writeFileSync(outFilePath, renderedTemplate);

console.info(`File ${outFilePath} has been created successfully.`);
