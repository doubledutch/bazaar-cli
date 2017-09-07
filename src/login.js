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

const resolveHome = function(filepath) {
    if (filepath[0] === '~') {
        return path.join(process.env.HOME, filepath.slice(1));
    }
    return filepath;
}

const bzHome = resolveHome('~/.bz')
const bzConfig = bzHome + '/config.json'

const authenticate = (username, pass) => {
  return new Promise((resolve, reject) => {
    const tokenURL = config.identity.root_url + '/access/tokens'
    const form = { grant_type: 'password', username: username, password: pass }
    const auth = 'Basic ' + new Buffer(config.identity.cli.identifier + ':' + config.identity.cli.secret).toString('base64')
    fetch(tokenURL , { body: formurlencoded(form), method: 'POST', headers: { 'Authorization': auth, 'Content-type': 'application/x-www-form-urlencoded' } })
      .then((response) => {
        if (response.status !== 200) {
          throw 'Invalid credentials'
        }
        return response.json()
      })
      .then((json) => {
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
    fs.unlinkSync(bzConfig)
  }

  fs.appendFileSync(
    bzConfig,
    JSON.stringify({ username: username, name: '', access_token: tokenResponse.access_token, refresh_token: tokenResponse.refresh_token }),
    permissionGeneral
  );
  console.info(`Created ${bzConfig}`);
}

const parseArguments = (args) => {
  const parser = new argparse.ArgumentParser({ prog: 'bz login' });
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
      console.log('To sign up for an account, please visit ' + config.signup_url)

      const makePromise = () => new Promise((resolve, reject) => {
        read({ prompt: 'Username: ', silent: false }, (_, username) => {
          read({ prompt: 'Password: ', silent: true }, (_, password) => {
            authenticate(username, password).then((result) => {
              maybeMakeDir(true, '~/.bz')
              saveConfig(username, result)
            }).catch((err) => {
              console.log(err)
            })
          })
        })
      })

      if (fileExists(bzConfig)) {
        const configJSON = JSON.parse(fs.readFileSync(bzConfig, 'utf8'))
        return new Promise((resolve, reject) => {
          read({ prompt: `Already authenticated as ${configJSON.username}. Overwrite? (Y/n) `, silent: false }, (_, res) => {
            if (res === 'Y') {
              return makePromise()
            } else {
              console.log('done')
              resolve()
            }
          })
        })
      } else {
        return makePromise()
      }
    });

module.exports = {
  run,
  description: 'Set you Bazaar developer account credentials',
};
