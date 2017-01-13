'use strict';

const package_json = require('../package.json');

const run = (args) =>
  Promise.resolve().then(() => {
    console.info(package_json.version);
  });

module.exports = {
  run,
  description: 'Print the version number of Bazaar',
};
