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

const permissionGeneral = {
  encoding: 'utf8',
  mode: 0o666,
}

const resolveHome = function(filepath) {
    if (filepath[0] === '~') {
        return path.join(process.env.HOME, filepath.slice(1));
    }
    return filepath;
}

const bzHome = resolveHome('~/.bz')
const bzConfig = bzHome + '/config.json'

const uninstall = (accountConfig, featureID, eventID) => {
  return new Promise((resolve, reject) => {
    // TODO - we should really just check the expiration of the token
    requestAccessToken(accountConfig.username, accountConfig.refresh_token).then((access_token) => {
      const installURL = config.root_url + '/api/features/' + featureID + '/installs'
      const auth = 'Bearer ' + access_token

      // TODO - set this on server based on token
      const json = { eventID: eventID }
      fetch(installURL, { body: JSON.stringify(json), method: 'DELETE', headers: { 'Authorization': auth, 'Content-type': 'application/json' } })
        .then((response) => {
          return response.json()
        })
        .then((json) => {
          if (json.error) {
            reject(json.error)
          } else {
            resolve(json)
          }
        })
        .catch((err) => {
          reject(err)
        })
    }).catch((err) => {
      reject(err)
    })
  })
}

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

const parseArguments = (args) => {
  const parser = new argparse.ArgumentParser({ prog: 'bz install' });
  parser.addArgument(['eventID'],
    {
      action: 'store',
      help: '(event-id)',
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

const run = (args) =>
  Promise.resolve(args)
    .then(parseArguments)
    .then((parsed) => {
      if (!fileExists('bazaar.json')) {
        console.log('This does not appear to be a Bazaar project. bazaar.json not found')
      } else {


        const configJSON = JSON.parse(fs.readFileSync(bzConfig, 'utf8'))
        const bazaarJSON = JSON.parse(fs.readFileSync('bazaar.json', 'utf8'))
        var bazaarFeatureID = null
        if (bazaarJSON.id) {
          console.log('Uninstalling feature from event')
        } else {
          console.log('Feature not published. Please publish the schema first')
          return
        }

        return new Promise((resolve, reject) => {
          uninstall(configJSON, bazaarJSON.id, parsed.eventID).then((result) => {
            console.log('Uninstallation complete')
          }).catch((err) => {
            console.log('ERROR: ' + err)
          })
        })
      }
    });

module.exports = {
  run,
  description: 'Publish your feature definition to Bazaar',
};
