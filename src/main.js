#!/usr/bin/env node
'use strict';

// To support `pidof bazaar`, by default it shows in `pidof node`
process.title = 'bazaar';

const chalk = require('chalk');
const path = require('path');

const initCommand = require('./init');
const upgradeCommand = require('./upgrade');
const versionCommand = require('./version');
const publishCommand = require('./publish');
const loginCommand = require('./login');
const installCommand = require('./install');
const uninstallCommand = require('./uninstall');

const NiceError = require('./utils/nice_error');
// Mapping from command line strings to modules. To add a new command,
// add an entry in this object, and create a module with the following
// exported:
// - run: main function for the command
// - description: a string to display in the bz help text
const commands = {
  init: initCommand,
  upgrade: upgradeCommand,
  login: loginCommand,
  version: versionCommand,
  publish: publishCommand,
  install: installCommand,
  uninstall: uninstallCommand
};

const programName = path.basename(process.argv[1]);

const help = () => {
  console.log(`Usage: ${programName} subcommand [args...]`);
  console.log('Available subcommands:');
  Object.keys(commands).forEach((cmdName) =>
    console.log(`  ${cmdName} - ${commands[cmdName].description}`)
  );
};

const allArgs = process.argv.slice(2);
if (allArgs.length === 0) {
  help();
  process.exit(1);
}

const cmdName = allArgs[0];
const cmdArgs = allArgs.slice(1);

if (cmdName === '-h' || cmdName === '--help' || cmdName === 'help') {
  help();
  process.exit(0);
}

const command = commands[cmdName];
if (!command) {
  console.error(chalk.red.bold(
    `No such subcommand ${cmdName}, run with -h for help`));
  process.exit(1);
}

const done = (err) => {
  if (err) {
    const errMsg = (err instanceof NiceError) ?
            err.niceString({ contextSize: 2 }) : err.message;
    console.error(chalk.red.bold(errMsg));
    process.exit(1);
  } else {
    process.exit(0);
  }
};

try {
  command.run(cmdArgs).then(() => done()).catch(done);
} catch (err) {
  done(err);
}
