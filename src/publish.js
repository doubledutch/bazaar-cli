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

const resolveHome = function (filepath) {
  if (filepath[0] === '~') {
    return path.join(process.env.HOME, filepath.slice(1));
  }
  return filepath;
}

const bzHome = resolveHome('~/.bz')
const bzConfig = bzHome + '/config.json'

const publishSchema = (accountConfig, json, featureID) => {
  return new Promise((resolve, reject) => {
    // TODO - we should really just check the expiration of the token
    requestAccessToken(accountConfig.username, accountConfig.refresh_token).then((access_token) => {
      const featureURL = config.root_url + '/api/features' + (featureID ? ('/' + featureID) : '')
      const method = featureID ? 'PUT' : 'POST'
      const auth = 'Bearer ' + access_token

      // TODO - set this on server based on token
      json.developer = { name: '', email: accountConfig.username, phone: '' }

      fetch(featureURL, { body: JSON.stringify(json), method: 'POST', headers: { 'Authorization': auth, 'Content-type': 'application/json' } })
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

const publishBinary = (accountConfig, json, featureID) => {
  return new Promise((resolve, reject) => {
    // TODO - we should really just check the expiration of the token
    requestAccessToken(accountConfig.username, accountConfig.refresh_token).then((access_token) => {
      const featureURL = config.root_url + '/api/features' + (featureID ? ('/' + featureID) : '')
      const method = featureID ? 'PUT' : 'POST'
      const auth = 'Bearer ' + access_token

      // TODO - set this on server based on token
      json.developer = { name: '', email: accountConfig.username, phone: '' }

      fetch(featureURL, { body: JSON.stringify(json), method: 'POST', headers: { 'Authorization': auth, 'Content-type': 'application/json' } })
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

const permissionGeneral = {
  encoding: 'utf8',
  mode: 0o666,
};

const requestAccessToken = (username, refresh_token) =>
  new Promise((resolve, reject) => {
    const tokenURL = config.identity.root_url + '/access/tokens'
    const form = { grant_type: 'refresh_token', refresh_token: refresh_token }
    const auth = 'Basic ' + new Buffer(config.identity.cli.identifier + ':' + config.identity.cli.secret).toString('base64')
    fetch(tokenURL , { body: formurlencoded(form), method: 'POST', headers: { 'Authorization': auth, 'Content-type': 'application/x-www-form-urlencoded' } })
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
    fs.unlink(bzConfig)
  }

  fs.appendFileSync(
    bzConfig,
    JSON.stringify({ username: username, name: '', access_token: tokenResponse.access_token, refresh_token: tokenResponse.refresh_token }),
    permissionGeneral
  );
}

const saveFeatureConfig = (feature) => {
  const featureConfig = 'bazaar.json'
  if (fileExists(featureConfig)) {
    fs.unlink(featureConfig)
  }

  fs.appendFileSync(
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
