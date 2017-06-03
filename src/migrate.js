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

const reactNativeVersion = config.react_native_version
const reactVersion = config.react_version

const migrateSH = () => `\
#!/usr/bin/env bash
rm migrate.sh
mkdir mobile
mv ./* mobile/
git clone https://github.com/doubledutch/bazaar-sample.git sample-tmp
rm -rf sample-tmp/mobile/
mv sample-tmp/* ./
mv mobile/bazaar.json ./
ln -h ./bazaar.json mobile/bazaar.json
rm -rf sample-tmp/
pushd mobile
npm install
popd
pushd web/admin
npm install
popd
pushd web/attendee
npm install
popd
`;

const parseArguments = (args) => {
  const parser = new argparse.ArgumentParser({ prog: 'bz migrate' });
  return parser.parseArgs(args);
};

const fileExists = (pathName) => {
  try {
    fs.statSync(pathName);
    return true;
  } catch (e) {
    return false;
  }
};

const maybeMakeDir = (createDir, dirName) => {
  if (createDir) {
    try {
      fs.mkdirSync(dirName);
      console.info(`Created new project directory ${dirName}`);
    } catch (e) {
      throw rethrow(e,
        `Couldn't make directory ${dirName}: ${e.message}`);
    }
  } else {
    console.info(`Initializing in existing directory ${dirName}`);
  }
};

const maybeChdir = (chdirTo) => {
  if (chdirTo) {
    try {
      process.chdir(chdirTo);
    } catch (e) {
      if (e.code === 'ENOTDIR') {
        throw rethrow(e, `${chdirTo} is not a directory`);
      } else {
        throw rethrow(e, `Couldn't chdir to ${chdirTo}: ${e.message}`);
      }
    }
  }
};

const populateDir = (projectName, dirWasPopulated, chdirTo, dirName) => {
  const niceDir = chdirTo ? `${dirName}/` : '';

  // Default permissions
  const permissionGeneral = {
    encoding: 'utf8',
    mode: 0o666,
  };

  const permissionSecret = {
    encoding: 'utf8',
    mode: 0o600, // Secrets are put in this config, so set it user, read/write only
  };

  // Create package.json if it doesn't exist
  if (!fileExists('package.json')) {
    fs.appendFileSync(
      'package.json',
      makePackageJSON(),
      permissionGeneral
    );
    console.info(`Created ${niceDir}package.json`);
  } else {
    console.info('package.json already exists, not touching it.');
  }

  // Create bazaar.json if it doesn't exist
  if (!fileExists('bazaar.json')) {
    fs.appendFileSync(
      'bazaar.json',
      makeFeatureJSON(projectName),
      permissionGeneral
    );
    console.info(`Created ${niceDir}bazaar.json`);
  } else {
    console.info('bazaar.json already exists, not touching it.');
  }

  if (!fileExists('bazaar.sh')) {
    fs.appendFileSync(
      'bazaar.sh',
      bazaarSH(projectName),
      permissionGeneral
    );
    console.info(`Created ${niceDir}bazaar.sh`);
  } else {
    console.info('bazaar.json already exists, not touching it.');
  }
};

const run = (args) =>
  new Promise((resolve, reject) => {
    Promise.resolve(args)
      .then(parseArguments)
      .then((parsed) => {

        const permissionGeneral = {
          encoding: 'utf8',
          mode: 0o666,
        };

        try {
          if (fs.existsSync('mobile')) {
            console.error('Project cannot be migrated')
            process.exit(-1)
          }

          if (!fileExists('migrate.sh')) {
            fs.appendFileSync(
              'migrate.sh',
              migrateSH(),
              permissionGeneral
            );
            console.info(`Created migrate.sh`);
          } else {
            console.info('migrate.sh already exists, not touching it.');
          }

          exec(`sh migrate.sh`, function (err, stdout, stderr) {
            if (err && err.length) {
              console.log(err)
              reject(err)
            } else if (stderr && stderr.length) {
              console.log(stderr)
              reject(stderr)
            } else {
              console.log('Finished migrating project')
            }
          })
        }
        catch (e) {
          console.log(e)
          reject()
        }
      })
  })

module.exports = {
  run,
  description: 'Initialize a new Bazaar project',
};
