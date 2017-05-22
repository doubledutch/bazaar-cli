/* global require, module */

'use strict';

const fs = require('fs');
const crypto = require('crypto');
const process = require('process');
const argparse = require('argparse');
const checkProjectName = require('./utils/check-project-name');
const rethrow = require('./utils/rethrow');
const exec = require('child_process').exec
const config = require('./config')

const parseArguments = (args) => {
  const parser = new argparse.ArgumentParser({ prog: 'bz upgrade' });
  parser.addArgument([ 'projectName' ],
    { action: 'store',
      help: 'Name of directory to upgrade. Defaults to current directory',
    }
  );
  return parser.parseArgs(args);
};

const run = (args) =>
  new Promise((resolve, reject) => {
    Promise.resolve(args)
      .then(parseArguments)
      .then((parsed) => {
        const check = checkProjectName(
          parsed.projectName,
          process.cwd(),
          fs.readdirSync('.')
        );
        const projectName = check.projectName;
        const dirName = check.dirName;
        const chdirTo = check.chdirTo;
        const createDir = check.createDir;
        maybeMakeDir(createDir, dirName);
        maybeChdir(chdirTo);

        // Before we create things, check if the directory is empty
        // const dirWasPopulated = fs.readdirSync(process.cwd()).length !== 0;
        // populateDir(projectName, dirWasPopulated, chdirTo, dirName);
        
        console.log(`Upgrade existing project`)

       /* exec(`sh bazaar.sh`, function(err, stdout, stderr) {
          if (err && err.length) {
            console.log(err)
            reject(err)
          } else if (stderr && stderr.length) {
            console.log(stderr)
            reject(stderr)
          } else {
            console.log('Finished creating project')
          }
        })*/
      })
  })

module.exports = {
  run,
  description: 'Upgrade an existing Bazaar project',
};
