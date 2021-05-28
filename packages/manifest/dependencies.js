const { CONFIGFILE_NAME } = require("./config");
const { addDependency, getPackageConfig } = require("./packageConfig");
const {
  fetchFromClioPackages,
  fetchGitHubZipArchive,
  fetchZipArchive,
  logFetching,
} = require("./utils/fetch");
const { isClioSource, parsePackageId } = require("./utils/parse");
const { installNpmDependency } = require("./npm_dependencies");

/* Package getters */

/**
 * Get a package dependencies
 * 
 * @returns {{name, version}}
 * @example 
[
  { name: 'hub:stdlib', version: 'latest' },
  { name: 'github:clio-lang/rethinkdb', version: 'latest' }
]
 */
function getPackageDependencies() {
  const config = getPackageConfig();
  return config.dependencies;
}

/**
 * Returns true if the project has at least one dependency listed in the package
 * config file.
 * @returns {bool}
 */
function hasClioDependencies() {
  const dependencies = getPackageDependencies();
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
      .filter((dep) => isClioSource(dep.name))
      .map((dep) => installDependency(dep.name))
  );
}

/* Dependency installation */

/**
 * Install a Clio dependency
 *
 * @param {object} argv
 * @param {string} argv.source - url, uri or id (name[@version]) of the package to fetch
 * @returns {promise}
 */
function installDependency(id, flags = {}) {
  if (flags.npm) return installNpmDependency(id, flags);

  const { url, branch, githubURI, source, version, name } = parsePackageId(id);

  if (url && !githubURI) {
    logFetching(url);

    return fetchZipArchive(url).then((successful) => {
      if (successful && !hasClioDependency([source, "latest"])) {
        addDependency([source, "latest"]);
      }
    });
  }

  if (githubURI) {
    return fetchGitHubZipArchive({ branch, uri: githubURI }).then(
      (successful) => {
        if (successful && !hasClioDependency([source, version])) {
          addDependency([source, version]);
        }
      }
    );
  }

  // not github, not an URL
  // fetch pkg info from clio-lang/packages by package id (name[@version])
  return fetchFromClioPackages({ branch, name }).then((successful) => {
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
  logNoClioDeps,
};
