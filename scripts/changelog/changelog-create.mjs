#!/usr/bin/env node

import moment from 'moment';
import ejs from 'ejs';
import meow from 'meow';
import chalk from 'chalk';
import esMain from 'es-main';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AllowedTypes = ['Added', 'Changed', 'Removed', 'Security'];

const scriptName = process.argv[1].split(path.sep).pop();

const flags = {
  message: {
    type: 'string',
    shortFlag: 'm',
    isMultiple: false,
    description: 'Message for the changelog entry'
  },
  version: {
    type: 'boolean',
    shortFlag: 'v',
    isMultiple: false,
    description: 'Show version number'
  },
  help: {
    type: 'boolean',
    shortFlag: 'h',
    isMultiple: false,
    description: 'Display this help message'
  },
  type: {
    type: 'string',
    shortFlag: 't',
    default: 'Added',
    isMultiple: false,
    choices: ['Added', 'Changed', 'Removed', 'Security'],
    description: `Type of the changelog entry`
  }
};

const examples = [
  { prompt: `name` },
  { prompt: `name --message "Message"` },
  { prompt: `name --type "Added"` },
  { prompt: `name --help` },
  { prompt: `name --version` }
];

function parseStringToArgs(str) {
  return str.match(/(?:[^\s"]+|"[^"]*")+/g);
}

function parseExample(prompt) {
  const args = parseStringToArgs(prompt);
  const parser = meow('', {
    argv: args,
    importMeta: import.meta,
    flags
  });
}
function parsePrompt(prompt, flags) {
  // how do I parse the prompt
  const inputArgs =
    prompt instanceof Array ? prompt : parseStringToArgs(prompt);

  const flagText = (str) => chalk.yellow(str);
  const exampleText = (str) => chalk.white(str);

  const cliOptionsText = (flags, padding = 16) => {
    const lines = [];
    for (const [key, value] of Object.entries(flags)) {
      const {
        type,
        shortFlag,
        description,
        default: defaultValue,
        choices
      } = value;
      const defaultText = defaultValue
        ? chalk.white(` (default: ${defaultValue})`)
        : '';
      const choicesText = choices
        ? chalk.white(` [choices: ${choices.join(', ')}]`)
        : '';
      lines.push(
        `${flagText(
          `--${key}, -${shortFlag}`.padEnd(padding)
        )}  ${description}${defaultText}${choicesText}`
      );
    }
    return lines.join('\n      ');
  };

  const cliUsageText = (flags) => {
    const lines = [];
    for (const [key, value] of Object.entries(flags)) {
      const { type, shortFlag, description, default: defaultValue } = value;

      const valueStr = type === 'string' ? `=<${key}>` : '';

      const flagStr = `[${flagText(
        `--${key}${valueStr} | -${shortFlag}${valueStr}`
      )}]`;
      lines.push(flagStr);
    }
    return lines.join(' ');
  };

  const cli = meow(
    `
    Usage
      $ ${chalk.white(scriptName)} name ${cliUsageText(flags)}

    Options
      ${cliOptionsText(flags)}
      
    Examples
      $ ${exampleText(scriptName)} name
      $ ${exampleText(scriptName)} name ${flagText('--message')} "Message"
      $ ${exampleText(scriptName)} ${flagText('--message')} "Message"
      $ ${exampleText(scriptName)} ${flagText('--type')} "Added"
      $ ${exampleText(scriptName)} ${flagText('--help')}
      $ ${exampleText(scriptName)} ${flagText('--version')}
  `,
    {
      argv: inputArgs.slice(2),
      importMeta: import.meta,
      flags
    }
  );
  if (!flags.type.choices.includes(cli.flags.type)) {
    console.error(`Invalid type: ${cli.flags.type}`);
    console.error(`Allowed types are: ${flags.type.choices.join(', ')}`);
    cli.showHelp();
    process.exit(1);
  }

  return cli;
}

function main(argv) {
  try {
    const cli = parsePrompt(argv, flags);

    if (cli.flags.help) {
      cli.showHelp();
      process.exit();
    }
    if (cli.flags.version) {
      console.log('1.0.0');
      process.exit();
    }

    const version = 'Unreleased';
    const type = cli.flags.type;
    const templatePath = path.resolve(__dirname, 'template.yml.ejs');
    const changeLogDir = path.resolve('./changelog', `${version}`);

    const input = cli.input.join(' ');

    if (!input || input.length === 0) {
      cli.showHelp();
      process.exit();
    }

    const message = cli.flags.message || cli.input.join(' ');
    const name = cli.input.join(' ').replace(/(\W+)/gi, '_');

    const dateFormat = 'YYYYDDMMHHmmss';

    const date = Date.now();
    const prefix = moment(date).format(dateFormat);
    const filename = `${prefix}-${name}.yaml`;

    const outFilePath = path.resolve(changeLogDir, filename);
    fs.mkdirSync(changeLogDir, { recursive: true });

    const template = fs.readFileSync(templatePath, 'utf-8');
    const data = { message, type };
    const renderedTemplate = ejs.render(template, data);

    fs.writeFileSync(outFilePath, renderedTemplate);

    console.info(`${chalk.grey(outFilePath)} has been created successfully.`);
  } catch (error) {
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

if (esMain(import.meta)) {
  main(process.argv);
}

export { main };
