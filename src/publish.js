/* global require, module */

'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const process = require('process');
const argparse = require('argparse');
const checkProjectName = require('./utils/check-project-name');
const rethrow = require('./utils/rethrow');
const read = require('./utils/read');
const fetch = require('node-fetch');
const formurlencoded = require('form-urlencoded')
const config = require('./config')
const DiffMatchPatch = require('diff-match-patch')
const exec = require('child_process').exec
const pkg = require('../package.json')
const NodeZip = require('node-zip')

const resolveHome = function (filepath) {
  if (filepath[0] === '~') {
    return path.join(process.env.HOME, filepath.slice(1));
  }
  return filepath;
}

const bzHome = resolveHome('~/.bz')
const bzConfig = bzHome + '/config.json'

const iosBaseBundle = `https://dd-bazaar.s3.amazonaws.com/lib/bundles/base.ios.${config.base_bundle_version}.bundle?raw=true`
const androidBaseBundle = `https://dd-bazaar.s3.amazonaws.com/lib/bundles/base.android.${config.base_bundle_version}.bundle?raw=true`
const iosBaseManifest = `https://dd-bazaar.s3.amazonaws.com/lib/bundles/base.ios.${config.base_bundle_version}.manifest`
const androidBaseManifest = `https://dd-bazaar.s3.amazonaws.com/lib/bundles/base.android.${config.base_bundle_version}.manifest`


const publishSchema = (accountConfig, json, featureID) => {
  return new Promise((resolve, reject) => {
    // TODO - we should really just check the expiration of the token
    requestAccessToken(accountConfig.username, accountConfig.refresh_token).then((access_token) => {
      const featureURL = config.root_url + '/api/features' + (featureID ? ('/' + featureID) : '')
      const method = featureID ? 'PUT' : 'POST'
      const auth = 'Bearer ' + access_token

      // TODO - set this on server based on token
      json.developer = { name: '', email: accountConfig.username, phone: '' }

      fetch(featureURL, { body: JSON.stringify(json), method: method, headers: { 'Authorization': auth, 'Content-type': 'application/json' } })
        .then((response) => {
          if (response.status !== 200) {
            throw 'Error creating/updating feature'
          }
          return response.json()
        })
        .then((json) => {
          resolve(json)
        })
        .catch((err) => {
          console.log(err)
          reject(err)
        })
    }).catch((err) => {
      console.log(err)
      reject(err)
    })
  })
}

const publishBinary = (accountConfig, bzJson, featureID) => {
  return new Promise((resolve, reject) => {
    // TODO - we should really just check the expiration of the token
    requestAccessToken(accountConfig.username, accountConfig.refresh_token).then((access_token) => {
      const featureURL = config.root_url + '/api/features' + (featureID ? ('/' + featureID) : '')
      const method = featureID ? 'PUT' : 'POST'
      const auth = 'Bearer ' + access_token

      // TODO - set this on server based on token
      bzJson.developer = { name: '', email: accountConfig.username, phone: '' }

      console.log(`Downloading iOS and Android base bundles (version ${config.base_bundle_version})`)
      Promise.all([
        fetch(iosBaseBundle).then((response) => response.text()),
        fetch(androidBaseBundle).then((response) => response.text()),
        fetch(iosBaseManifest).then((response) => response.text()),
        fetch(androidBaseManifest).then((response) => response.text())
      ])
        .then((results) => {
          const [iosBase, androidBase, iosManifest, androidManifest] = results
          const dmp = new DiffMatchPatch()
          dmp.Diff_Timeout = 60

          exec(`rm -rf build/`, (err, stdout, stderr) => {
            exec(`rm -rf tmp/`, (err, stdout, stderr) => {

              if (!fs.existsSync('build')) {
                fs.mkdirSync('build');
              }
              if (!fs.existsSync('build/bundle')) {
                fs.mkdirSync('build/bundle');
              }
              if (!fs.existsSync('build/site')) {
                fs.mkdirSync('build/site');
              }
              if (!fs.existsSync('build/site/private')) {
                fs.mkdirSync('build/site/private');
              }
              if (!fs.existsSync('build/site/public')) {
                fs.mkdirSync('build/site/public');
              }
              if (!fs.existsSync('build/api')) {
                fs.mkdirSync('build/api');
              }
              if (!fs.existsSync('tmp')) {
                fs.mkdirSync('tmp');
              }

              fs.writeFileSync(`tmp/base.ios.${config.base_bundle_version}.bundle`, iosBase, { encoding: 'utf8' })
              fs.writeFileSync(`tmp/base.android.${config.base_bundle_version}.bundle`, androidBase, { encoding: 'utf8' })

              fs.writeFileSync(`tmp/base.ios.${config.base_bundle_version}.manifest`, iosManifest, { encoding: 'utf8' })
              fs.writeFileSync(`tmp/base.android.${config.base_bundle_version}.manifest`, androidManifest, { encoding: 'utf8' })

              const commands = []

              if (bzJson.components.mobile.enabled) {
                commands.push(
                  //[`pushd mobile && npm run build-web`, 'Generating Web feature bundle'],
                  //[`pushd mobile && cp -r web/static/ ../build/bundle/`, 'Copying Web feature bundle'],
                  [`
                    pushd mobile &&
                    node node_modules/dd-rn-packager/react-native/local-cli/cli.js bundle 
                    --dev false
                    --manifest-file ../tmp/base.ios.${config.base_bundle_version}.manifest
                    --manifest-output ../build/bundle/index.ios.${config.base_bundle_version}.manifest
                    --platform ios
                    --entry-file index.ios.js
                    --bundle-output ../build/bundle/index.ios.${config.base_bundle_version}.manifest.bundle
                    --sourcemap-output ../build/bundle/index.ios.${config.base_bundle_version}.sourcemap
                    --post-process-modules $PWD/node_modules/dd-rn-packager/process.js
                    --create-module-id-factory $PWD/node_modules/dd-rn-packager/idfactory.js
                    `, 'Building iOS'],
                  [`
                    pushd mobile &&
                    node node_modules/dd-rn-packager/react-native/local-cli/cli.js bundle 
                    --dev false
                    --manifest-file ../tmp/base.android.${config.base_bundle_version}.manifest
                    --manifest-output ../build/bundle/index.android.${config.base_bundle_version}.manifest
                    --platform android
                    --entry-file index.android.js
                    --bundle-output ../build/bundle/index.android.${config.base_bundle_version}.manifest.bundle
                    --sourcemap-output ../build/bundle/index.android.${config.base_bundle_version}.sourcemap
                    --post-process-modules $PWD/node_modules/dd-rn-packager/process.js
                    --create-module-id-factory $PWD/node_modules/dd-rn-packager/idfactory.js
                    `, 'Building Android']
                )
              } else {
                commands.push(
                  [``, 'Mobile build not enabled']
                )
              }

              if (bzJson.components.api.enabled) {
                commands.push(
                  [`pushd api && npm run build`, 'Generating API scripts'],
                  [`cp -r api/build/ build/api/`, 'Copying APIs']
                )
              } else {
                commands.push(
                  [``, 'API build not enabled']
                )
              }

              if (bzJson.components.adminWeb.enabled) {
                commands.push(
                  [`pushd web/admin && npm run build`, 'Generating Admin web bundle'],
                  [`cp -r web/admin/build/ build/site/private/`, 'Copying Admin web bundle']
                )
              } else {
                commands.push(
                  [``, 'Admin web build not enabled']
                )
              }

              if (bzJson.components.attendeeWeb.enabled) {
                commands.push(
                  [`pushd web/attendee && npm run build`, 'Generating Attendee web bundle'],
                  [`cp -r web/attendee/build/ build/site/public/`, 'Copying Attendee web bundle']
                )
              } else {
                commands.push(
                  [``, 'Attendee web build not enabled']
                )
              }

              commands.push(
                [`zip -r tmp/build.${config.base_bundle_version}.zip build/`, 'Generating zip']
              )

              const promise = new Promise((resolve, reject) => {
                const runCommand = (idx) => {
                  if (idx < commands.length) {
                    console.log(commands[idx][1] + '...')
                    exec(commands[idx][0].replace(/\n/g, ''), (err, stdout, stderr) => {
                      if (err) {
                        console.error(err)
                      }
                      if (stderr) {
                        console.error(stderr)
                      }
                      runCommand(idx + 1)
                    })
                  } else {
                    resolve()
                  }
                }

                runCommand(0)
              })

              promise
                .then(() => {
                  console.log('Done. Uploading to bazaar...')
                  const zipFile = fs.readFileSync(`tmp/build.${config.base_bundle_version}.zip`)

                  console.log('Uploading binaries')
                  const featureURL = `${config.root_url}/api/features/${featureID}/binaries`
                  const auth = 'Bearer ' + access_token

                  const json = {
                    cliVersion: pkg.version,
                    version: bzJson.version || '0.0.1',
                    reactNativeVersion: config.base_bundle_version,
                    zippedPackage: new Buffer(zipFile).toString('base64')
                  }

                  fetch(featureURL, { body: JSON.stringify(json), method: 'POST', headers: { 'Authorization': auth, 'Content-type': 'application/json' } })
                    .then((response) => {
                      if (response.status !== 200) {
                        throw 'Error creating/updating feature'
                      }
                      return response.json()
                    })
                    .then((json) => {
                      console.log(json)
                      resolve(json)
                      process.exit(0)
                    })
                    .catch((err) => {
                      console.log(err)
                      reject(err)
                    })
                })
                .catch((err) => {
                  console.log(err)
                  process.exit(-1)
                })
            })
          })

        })
        .catch((err) => {
          console.log(err)
          reject(err)
        })
    }).catch((err) => {
      console.log(err)
      reject(err)
    })
  })
}

const permissionGeneral = {
  encoding: 'utf8',
  mode: 0o666,
};

const requestAccessToken = (username, refresh_token) =>
  new Promise((resolve, reject) => {
    const tokenURL = config.identity.root_url + '/access/tokens'
    const form = { grant_type: 'refresh_token', refresh_token: refresh_token }
    const auth = 'Basic ' + new Buffer(config.identity.cli.identifier + ':' + config.identity.cli.secret).toString('base64')
    fetch(tokenURL, { body: formurlencoded(form), method: 'POST', headers: { 'Authorization': auth, 'Content-type': 'application/x-www-form-urlencoded' } })
      .then((response) => {
        if (response.status !== 200) {
          throw 'Invalid credentials. Please run bz login'
        }
        return response.json()
      })
      .then((result) => {
        saveConfig(username, result)
        resolve(result.access_token)
      })
      .catch((err) => {
        reject(err)
      })
  })

const saveConfig = (username, tokenResponse) => {
  if (fileExists(bzConfig)) {
    fs.unlinkSync(bzConfig)
  }

  fs.appendFileSync(
    bzConfig,
    JSON.stringify({ username: username, name: '', access_token: tokenResponse.access_token, refresh_token: tokenResponse.refresh_token }),
    permissionGeneral
  );
}

const saveFeatureConfig = (feature) => {
  const featureConfig = 'bazaar.json'

  fs.writeFileSync(
    featureConfig,
    JSON.stringify(feature, null, 2),
    permissionGeneral
  );
  console.info(`Updated ${featureConfig}`);
}

const parseArguments = (args) => {
  const parser = new argparse.ArgumentParser({ prog: 'bz publish' });
  parser.addArgument(['action'],
    {
      action: 'store',
      help: '(schema,binary)',
    }
  );
  return parser.parseArgs(args);
};

const maybeMakeDir = (createDir, dirName) => {
  if (createDir) {
    try {
      console.log(resolveHome(dirName))
      fs.mkdirSync(resolveHome(dirName));
      console.info(`Created new project directory ${dirName}`);
    } catch (e) {
      console.log('Directory exists')
    }
  } else {
    console.info(`Initializing in existing directory ${dirName}`);
  }
};

const fileExists = (pathName) => {
  try {
    fs.statSync(pathName);
    return true;
  } catch (e) {
    return false;
  }
};

const run = (args) =>
  Promise.resolve(args)
    .then(parseArguments)
    .then((parsed) => {
      if (!fileExists('bazaar.json')) {
        console.log('This does not appear to be a Bazaar project. bazaar.json not found')
      } else {

        if (!fileExists(bzConfig)) {
          console.log('You have not yet logged in to bazaar. Please run bz login')
        } else {
          const configJSON = JSON.parse(fs.readFileSync(bzConfig, 'utf8'))
          const bazaarJSON = JSON.parse(fs.readFileSync('bazaar.json', 'utf8'))
          var bazaarFeatureID = null
          if (bazaarJSON.id) {
            console.log('Publishing update')
            bazaarFeatureID = bazaarJSON.id
          } else {
            console.log('Publishing v1')
          }
          if (parsed.action === 'schema') {
            return new Promise((resolve, reject) => {
              publishSchema(configJSON, bazaarJSON, bazaarFeatureID).then((result) => {
                saveFeatureConfig(result)
              }).catch((err) => {
                console.log(err)
              })
            })
          } else if (parsed.action === 'binary') {
            return new Promise((resolve, reject) => {
              publishBinary(configJSON, bazaarJSON, bazaarFeatureID).then((result) => {
                console.log(result)
              }).catch((err) => {
                console.log(err)
              })
            })
          } else {
            console.log('Not supported')
          }
        }
      }
    });

module.exports = {
  run,
  description: 'Publish your feature definition to Bazaar',
};
