const { CONFIGFILE_NAME } = require("./config");
const { addDependency, getPackageConfig } = require("./packageConfig");
const {
  fetchFromClioPackages,
  fetchGitHubZipArchive,
  fetchZipArchive,
  logFetching
} = require("./utils/fetch");
const { isClioSource, parsePackageId } = require("./utils/parse");

/* Package getters */

/**
 * Get a package dependencies
 * 
 * @param {string|undefined} manifestFilePath optional path to config file
 * @returns {{name, version}}
 * @example 
[
  { name: 'hub:stdlib', version: 'latest' },
  { name: 'github:clio-lang/rethinkdb', version: 'latest' }
]
 */
function getPackageDependencies(manifestFilePath) {
  let config;

  if (manifestFilePath) {
    config = getPackageConfig(manifestFilePath);
  } else {
    config = getPackageConfig();
  }
  return config.dependencies;
}

/**
 * Returns true if the project has at least one dependency listed in the package
 * config file.
 * @param {string|undefined} manifestFilePath optional path to config file
 * @returns {bool}
 */
function hasClioDependencies(manifestFilePath) {
  let dependencies;
  if (manifestFilePath) {
    dependencies = getPackageDependencies(manifestFilePath);
  } else {
    dependencies = getPackageDependencies();
  }

  return !!dependencies && !!Object.keys(dependencies).length;
}

const logNoClioDeps = () =>
  console.log(`No dependencies found in ${CONFIGFILE_NAME}`);

/**
 * Returns true if the project has at least one dependency listed in the package
 * config file.
 *
 * @params {string[]} depId - [id, version] of the dependency to check
 * @returns {bool}
 */
function hasClioDependency([depId, depVersion]) {
  const found = getPackageDependencies().find(
    ({ name, version }) => name === depId && version === depVersion
  );

  return found !== undefined;
}

/* Dependency fetching */

/**
 * Installs every dependency listed in project manifest
 *
 * @returns {void|promise}
 */
function fetchDependencies() {
  if (!hasClioDependencies()) {
    logNoClioDeps();
    return;
  }

  return Promise.all(
    getPackageDependencies()
      .filter(dep => isClioSource(dep.name))
      .map(dep => installDependency(dep.name))
  );
}

/* Dependency installation */

/**
 * Install a Clio dependency
 *
 * @param {string} id id of the dependency, including its prefix
 * @returns {promise}
 */
function installDependency(id) {
  const { url, branch, githubURI, source, version, name } = parsePackageId(id);

  if (url && !githubURI) {
    logFetching(url);

    return fetchZipArchive(url).then(successful => {
      if (successful && !hasClioDependency([source, "latest"])) {
        addDependency([source, "latest"]);
      }
    });
  }

  if (githubURI) {
    return fetchGitHubZipArchive({ branch, uri: githubURI }).then(
      successful => {
        if (successful && !hasClioDependency([source, version])) {
          addDependency([source, version]);
        }
      }
    );
  }

  // not github, not an URL
  // fetch pkg info from clio-lang/packages by package id (name[@version])
  return fetchFromClioPackages({ branch, name }).then(successful => {
    if (successful && !hasClioDependency([source, version])) {
      addDependency([source, version]);
    }
  });
}

module.exports = {
  fetchDependencies,
  getPackageDependencies,
  hasClioDependencies,
  installDependency,
  logNoClioDeps
};
