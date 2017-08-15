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
const prompt = require('prompt')

const reactNativeVersion = config.react_native_version
const reactVersion = config.react_version
const baseBundleVersion = config.base_bundle_version

const makePackageJSON = (projectName) => `\
{
  "name": "${projectName}",
  "version": "0.0.1",
  "baseBundleVersion": "${baseBundleVersion}",
  "private": true,
  "scripts": {
    "start": "react-native start",
    "run" : "node_modules/react-native/local-cli/cli.js run-ios"
  },
  "dependencies": {
    "react": "${reactVersion}",
    "react-native": "${reactNativeVersion}",
    "react-native-cli": "^2.0.1"
  },
  "devDependencies": {
  }
}
`;

const bazaarSH = (projectName, buildSettings) => `\
#!/usr/bin/env bash
date
echo '${projectName}'
yarn install | npm install
git clone https://github.com/doubledutch/bazaar-sample.git tmp
rm -rf tmp/.git
shopt -s dotglob && mv tmp/* ./
cd tmp
node ../node_modules/react-native-cli/index.js init ${projectName} --version react-native@${reactNativeVersion}
cd ..
mkdir mobile
mkdir mobile/ios
mv tmp/${projectName}/ios/* mobile/ios/
mkdir mobile/android
mv tmp/${projectName}/android/* mobile/android/
cd mobile
ln -h ../bazaar.json
sed -i '' 's/bazaar_sample/${projectName}/' package.json
sed -i '' 's/bazaar_sample/${projectName}/' index.ios.js
sed -i '' 's/bazaar_sample/${projectName}/' index.android.js
sed -i '' 's/bazaar_sample/${projectName}/' index.web.js
yarn install | npm install
rm -rf node_modules/bazaar-client/node_modules/react-native/
echo 'Fixing up xcode to use DD packager'
sed -i.bak s/node_modules\\\\/react-native\\\\/packager/node_modules\\\\/dd-rn-packager\\\\/react-native\\\\/packager/g ios/${projectName}.xcodeproj/project.pbxproj
sed -i.bak s/packager\\\\/launchPackager.command/..\\\\/dd-rn-packager\\\\/react-native\\\\/packager\\\\/launchPackager.command/g node_modules/react-native/React/React.xcodeproj/project.pbxproj
cd ..
echo rm -rf tmp
echo Installing dependencies
pushd mobile
${buildSettings.mobile ? 'yarn install | npm install' : ''}
popd
pushd web/admin
${buildSettings.adminWeb ? 'yarn install | npm install' : ''}
popd
pushd web/attendee
${buildSettings.attendeeWeb ? 'yarn install | npm install' : ''}
popd
date
`;

const makeFeatureJSON = (projectName, buildSettings) => `\
{
  "name": "${projectName}",
  "version": "0.0.1",
  "baseBundleVersion": "${config.base_bundle_version}",
  "description": "Description for ${projectName}",
  "collections": [
    {
      "description": "test",
      "globalReadAccess": false,
      "globalWriteAccess": false,
      "name": "some_collection",
      "userWriteAccess": true
    }
  ],
  "components": {
    "mobile": {
      "enabled": ${buildSettings.mobile},
      "build": true
    },
    "api": {
      "enabled": ${buildSettings.api},
      "build": true
    },
    "adminWeb": {
      "enabled": ${buildSettings.adminWeb},
      "build": true,
      "customURL": ""
    },
    "attendeeWeb": {
      "enabled": ${buildSettings.attendeeWeb},
      "build": true,
      "customURL": ""
    }
  }
}
`;

const gitignore = () => `\
node_modules
`;

const parseArguments = (args) => {
  const parser = new argparse.ArgumentParser({ prog: 'bz init' });
  parser.addArgument(['projectName'],
    {
      action: 'store',
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

const populateDir = (projectName, dirWasPopulated, chdirTo, dirName, buildSettings) => {
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
      makeFeatureJSON(projectName, buildSettings),
      permissionGeneral
    );
    console.info(`Created ${niceDir}bazaar.json`);
  } else {
    console.info('bazaar.json already exists, not touching it.');
  }

  if (!fileExists('bazaar.sh')) {
    fs.appendFileSync(
      'bazaar.sh',
      bazaarSH(projectName, buildSettings),
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

        prompt.start({
          message: '\0',
          delimiter: ' '
        })


        // "mobile": {
        //   "enabled": true,
        //   "build": true
        // },
        // "api": {
        //   "enabled": true,
        //   "build": true
        // },
        // "adminWeb": {
        //   "enabled": true,
        //   "build": true,
        //   "customURL": ""
        // },
        // "attendeeWeb": {
        //   "enabled": true,
        //   "build": true,
        //   "customURL": ""
        // }

        prompt.get([
          {
            name: 'mobile',
            description: 'Create mobile template',
            type: 'boolean',
            required: true,
            default: 't'
          },
          {
            name: 'api',
            description: 'Create API/lambda template',
            type: 'boolean',
            required: true,
            default: 't'
          },
          {
            name: 'adminWeb',
            description: 'Create admin web template',
            type: 'boolean',
            required: true,
            default: 't'
          },
          {
            name: 'attendeeWeb',
            description: 'Create attendee web template',
            type: 'boolean',
            required: true,
            default: 'f'
          }
        ], function (err, buildSettings) {
          if (err) {
            process.exit(-1)
            return
          }

          const projectName = check.projectName;
          const dirName = check.dirName;
          const chdirTo = check.chdirTo;
          const createDir = check.createDir;
          maybeMakeDir(createDir, dirName);
          maybeChdir(chdirTo);

          // Before we create things, check if the directory is empty
          const dirWasPopulated = fs.readdirSync(process.cwd()).length !== 0;
          populateDir(projectName, dirWasPopulated, chdirTo, dirName, buildSettings);

          console.log(`Initializing project (this may take a few minutes...)`)

          const p = exec(`sh bazaar.sh`, function (err, stdout, stderr) {
            console.log('Finished creating project')
            setTimeout(() => {
              if (err && err.length) {
                //console.log(err)
                reject(err)
              } else if (stderr && stderr.length) {
                //console.log(stderr)
                reject(stderr)
              } else {
                resolve('Finished creating project')
              }
            }, 2000)
          })
          p.stdout.on('data', function (data) {
            process.stdout.write('init: ' + data);
          })
        })
      })
  })

module.exports = {
  run,
  description: 'Initialize a new Bazaar project',
};
