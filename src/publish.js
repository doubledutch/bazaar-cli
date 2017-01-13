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

const resolveHome = function (filepath) {
  if (filepath[0] === '~') {
    return path.join(process.env.HOME, filepath.slice(1));
  }
  return filepath;
}

const publishSchema = (json, featureID) => {
  return new Promise((resolve, reject) => {
    const featureURL = config.root_url + '/api/features' + (featureID ? ('/' + featureID) : '')
    const method = featureID ? 'PUT' : 'POST'
    const auth = 'LOOKUP TOKEN HERE'

    // TODO - set this on server based on token
    json.developer = { name: '', email: '', phone: '' }

    fetch(featureURL, { body: JSON.stringify(json), method: 'POST', headers: { 'Authorization': auth, 'Content-type': 'application/json' } })
      .then((response) => {
        if (response.status !== 200) {
          throw 'Invalid credentials'
        }
        return response.json()
      })
      .then((json) => {
        console.log(json)
        resolve(json)
      })
      .catch((err) => {
        reject(err)
      })
  })
}

const permissionGeneral = {
  encoding: 'utf8',
  mode: 0o666,
};

const saveConfig = (username, tokenResponse) => {
  if (fileExists(bzConfig)) {
    fs.unlink(bzConfig)
  }

  fs.appendFileSync(
    bzConfig,
    JSON.stringify({ username: username, access_token: tokenResponse.access_token, refresh_token: tokenResponse.refresh_token }),
    permissionGeneral
  );
  console.info(`Created ${bzConfig}`);
}

const parseArguments = (args) => {
  const parser = new argparse.ArgumentParser({ prog: 'hz publish' });
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
        const bazaarJSON = JSON.parse(fs.readFileSync('bazaar.json', 'utf8'))
        var bazaarFeatureID = null
        if (fileExists('bazaar.json.lock')) {
          // We already exist
          const bazaarLockJSON = JSON.parse(fs.readFileSync('bazaar.json', 'utf8'))
          bazaarFeatureID = bazaarLockJSON.id

          console.log('Publishing update')
        } else {
          console.log('Publishing v1')
        }
        if (parsed.action === 'schema') {
          return new Promise((resolve, reject) => {
            publishSchema(bazaarJSON, bazaarFeatureID).then((result) => {
              console.log(result)
            }).catch((err) => {
              console.log(err)
            })
          })
        } else {
          console.log('Not supported')
        }
      }
    });

module.exports = {
  run,
  description: 'Publish your feature definition to Bazaar',
};
