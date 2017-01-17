/* global require, module */

'use strict';

const fs = require('fs');
const crypto = require('crypto');
const process = require('process');
const argparse = require('argparse');
const checkProjectName = require('./utils/check-project-name');
const rethrow = require('./utils/rethrow');
const exec = require('child_process').exec

const reactNativeVersion = '0.33.0'

const makePackageJSON = (projectName) => `\
{
  "name": "${projectName}",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "start": "react-native start",
    "run" : "node_modules/react-native/local-cli/cli.js run-ios"
  },
  "dependencies": {
    "@horizon/client": "^2.0.0",
    "bazaar-client": "^0.0.9",
    "react": "15.3.1",
    "react-addons-update": "15.3.1",
    "react-native": "${reactNativeVersion}",
    "react-native-cli": "^2.0.1"
  },
  "devDependencies": {
    "babel-plugin-add-module-exports": "^0.2.1",
    "babel-plugin-transform-runtime": "^6.15.0",
    "babel-preset-es2015": "^6.18.0",
    "babel-preset-es2015-loose": "^8.0.0"
  }
}
`;

const bazaarSH = (projectName) => `\
#!/usr/bin/env bash
echo '${projectName}'
npm install
git clone https://github.com/doubledutch/bazaar-sample.git tmp
mv tmp/* ./
cd tmp
node ../node_modules/react-native-cli/index.js init ${projectName} --version react-native@${reactNativeVersion}
cd ..
mkdir ios
mv tmp/${projectName}/ios/* ios/
mkdir android
mv tmp/${projectName}/android/* android/
sed -i '' 's/bazaar_sample/${projectName}/' package.json
sed -i '' 's/bazaar_sample/${projectName}/' index.ios.js
sed -i '' 's/bazaar_sample/${projectName}/' index.android.js
npm install
rm -rf tmp
rm -rf node_modules/bazaar-client/node_modules/react-native/
`;

const makeFeatureJSON = (projectName) => `\
{
  "name": "${projectName}",
  "description": "Description for ${projectName}",
  "collections": [
    {
      "description": "test",
      "globalReadAccess": false,
      "globalWriteAccess": false,
      "name": "some_collection",
      "userWriteAccess": true
    }
  ]
}
`;

const gitignore = () => `\
node_modules
`;

const parseArguments = (args) => {
  const parser = new argparse.ArgumentParser({ prog: 'bz init' });
  parser.addArgument([ 'projectName' ],
    { action: 'store',
      help: 'Name of directory to create. Defaults to current directory',
    }
  );
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
        const dirWasPopulated = fs.readdirSync(process.cwd()).length !== 0;
        populateDir(projectName, dirWasPopulated, chdirTo, dirName);
        
        console.log(`Initializing project`)

        exec(`sh bazaar.sh`, function(err,stdout,stderr) {
          if (err && err.length) {
            console.log(err)
            reject(err)
          } else if (stderr && stderr.length) {
            console.log(stderr)
            reject(stderr)
          } else {
            console.log('Finished creating project')
          }
        })
      })
  })

module.exports = {
  run,
  description: 'Initialize a new Bazaar project',
};
