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
const fetch = require('node-fetch')

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

const isVersionLess = (version) => {
  const baseVersionParts = (config.base_bundle_version).split('.').map((i) => parseInt(i, 10))
  const projectVersionParts = (version || '0.0.0').split('.').map((i) => parseInt(i, 10))

  for (var i = 0; i < baseVersionParts.length; ++i) {
    if (projectVersionParts[i] < baseVersionParts[i]) {
      return true
    }
  }

  return false
}

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
            // We are a non-structural update
            var bazaarJson = JSON.parse(fs.readFileSync('bazaar.json', 'utf8'))
            if (isVersionLess(bazaarJson.baseBundleVersion)) {
              console.log('Project can be updated')
              var packageJson = JSON.parse(fs.readFileSync('mobile/package.json', 'utf8'))
              fetch('https://raw.githubusercontent.com/doubledutch/bazaar-sample/master/mobile/package.json')
                .then((res) => res.json())
                .then((samplePackage) => {
                  const versions = Object.assign({}, samplePackage.dependencies, samplePackage.devDependencies)

                  Object.keys(packageJson.dependencies).forEach((mod) => {
                    // Move to dev if it is there
                    if (samplePackage.devDependencies[mod]) {
                      delete packageJson.dependencies[mod]
                    } else if (versions[mod]) {
                      console.log(`Updating ${mod} to ${versions[mod]}`)
                      packageJson.dependencies[mod] = versions[mod]
                    }
                  })

                  Object.keys(packageJson.devDependencies).forEach((mod) => {
                    if (samplePackage.dependencies[mod]) {
                      delete packageJson.devDependencies[mod]
                    } else if (versions[mod]) {
                      console.log(`Updating ${mod} to ${versions[mod]}`)
                      packageJson.devDependencies[mod] = versions[mod]
                    }
                  })

                  Object.keys(samplePackage.dependencies).forEach((mod) => {
                    if (!packageJson[mod]) {
                      console.log(`Adding  ${mod} @ ${versions[mod]}`)
                      packageJson.dependencies[mod] = samplePackage.dependencies[mod]
                    }
                  })

                  Object.keys(samplePackage.devDependencies).forEach((mod) => {
                    if (!packageJson[mod]) {
                      console.log(`Adding  ${mod} @ ${versions[mod]}`)
                      packageJson.devDependencies[mod] = samplePackage.devDependencies[mod]
                    }
                  })

                  bazaarJson.baseBundleVersion = config.base_bundle_version

                  fs.writeFileSync('mobile/package.json', JSON.stringify(packageJson, 2, 2), 'utf8')
                  fs.writeFileSync('bazaar.json', JSON.stringify(bazaarJson, 2, 2), 'utf8')
                  fs.unlinkSync('mobile/package-lock.json')

                  console.log('Removing older packages')
                  exec(`rm -rf mobile/node_modules`, function (err, stdout, stderr) {

                    console.log('Installing newer packages')
                    exec(`cd mobile && npm install`, function (err, stdout, stderr) {
                      console.log('You\'re all set!')
                      process.exit(0)
                    })
                  })
                })
            } else {
              console.error('Project cannot be migrated')
              process.exit(-1)
            }
            return
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
