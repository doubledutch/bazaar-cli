const process = require('process')
const { spawnSync } = require('child_process')
const semver = require('semver')
const requiredYarnVersion = '>=0.27.5'

function getYarnInstallation() {
  const { stdout, signal, error } = spawnSync('yarn', ['--version'])

  const version = stdout && semver.clean(stdout.toString())
  if (error || signal || !semver.valid(version)) {
    return {
      isInstalled: false,
      version: null,
    }
  }


  return {
    isInstalled: true,
    version
  }
}

const notInstalledMessage = `
'yarn' is not installed. Please run...

  brew install yarn

or...

  brew install yarn --without-node # if using nvm or similar

 See https://yarnpkg.com/en/docs/install#mac-tab for details
`

const wrongVersionMessage = `
'yarn' ${requiredYarnVersion} is required. Please run...

  brew update
  brew upgrade yarn

See https://yarnpkg.com for details
`

function enforceYarnInstallation() {
  const { isInstalled, version, message } = getYarnInstallation()

  if (!isInstalled) {
    console.log(notInstalledMessage)
    process.exit(1)
  } else if (!semver.satisfies(version, requiredYarnVersion)) {
    console.log(wrongVersionMessage)
    process.exit(1)
  }
}

module.exports = {
  requiredYarnVersion,
  getYarnInstallation,
  enforceYarnInstallation
}
