const fs = require("fs");

const decompress = require("decompress");
const tmp = require("tmp");
const fetch = require("node-fetch");

const { ENV_NAME } = require("./config");
const { addDependency, getPackageConfig } = require("./packageConfig");

/* Package getters */

/**
 * Get a package dependencies
 * 
 * @returns {{name, version}}
 * @example 
[
  { name: 'stdlib', version: 'latest' },
  { name: 'github.com/clio-lang/rethinkdb@2.2.3', version: 'latest' }
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

/**
 * Returns true if the project has at least one dependency listed in the package
 * config file.
 *
 * @params {string} depId - id of the dependency to check
 * @params {string} depVersion - version string of the dependency to check
 * @returns {bool}
 */

function hasDependency([depId, depVersion]) {
  const found = getPackageDependencies().find(
    ({ name, version }) => name === depId && version === depVersion
  );

  return found !== undefined;
}

/* Dependency getters */

const VERSION_REGEX = /@(\d\.?){1,3}$/gi;

/**
 * Gets the version number (if any) of the desidered dependency.
 * 
 * @param {string} argv
 * @returns {string}
 * 
 * @example
getVersion('foo') // ''
getVersion('foo@bar') // ''
getVersion('foo@1.2.3') // 1.2.3
 */

function getVersion(argv) {
  const matches = argv.match(VERSION_REGEX);

  return matches ? matches[0].replace("@", "") : "";
}

/**
 * Returns true when the desidered dependency specifies a version.
 * 
 * @param {string} id
 * @returns {boolean}
 * 
 * @example
hasVersion('foo@1.2.3') // true
hasVersion('foo') // false
 */
const hasVersion = id => !!getVersion(id).length;

/**
 * Returns a copy of the string with the version tag.
 *
 * @param {string} id
 * @returns {string}
 *
 * @example stripAtVersion('foo@1.2.3') // foo
 */
const stripAtVersion = id => id.replace(VERSION_REGEX, "");

/**
 * Returns an object whose properties represent significant elements
 * of the provided source string.
 * 
 * @param {string} id
 * @returns {string}
 * 
 * @example
> parseSource('foo')
{
  branch: 'master',
  isVersioned: false,
  name: 'foo',
  version: 'latest'
}

> parseSource('github.com/clio-lang/rethinkdb@2.3.3')
{
  branch: 'v2.3.3',
  id: 'github.com/clio-lang/rethinkdb@2.3.3',
  isVersioned: true,
  name: 'github.com/clio-lang/rethinkdb',
  version: '2.3.3'
}
 */
const parseSource = id => {
  const isVersioned = hasVersion(id);
  const version = isVersioned ? getVersion(id) : "latest";
  const branch = isVersioned ? `v${version}` : "master";
  const name = isVersioned ? stripAtVersion(id) : id;

  return { branch, id, isVersioned, name, version };
};

/* Dependency fetching */

/**
 * Installs every dependency listed in package.json
 *
 * @returns {void|promise}
 */

function fetchDependencies() {
  if (!hasClioDependencies()) {
    console.log("No dependencies found in package.json");
    return;
  }

  return Promise.all(
    getPackageDependencies().map(dep => installDependency({ source: dep.name }))
  );
}

const GITHUB_REGEX = /github\.com\/(\w|\d|_|-).+\/(\d|\w|-|_).+/gi;
const URL_REGEX = /https?:\/\/.+/gi;

/**
 * Installs a Clio dependency
 *
 * @param {object} argv
 * @param {string} argv.source - url, uri or id (name[@version]) of the package to fetch
 * @returns {void}
 */

function installDependency({ source }) {
  // url first (could also be a github zip url)
  const urlMatch = source.match(URL_REGEX);
  if (urlMatch) {
    logFetching(urlMatch[0]);

    return fetchZipContent({ url: urlMatch[0] }).then(successful => {
      if (successful && !hasDependency([source, "latest"])) {
        addDependency([source, "latest"]);
      }
    });
  }

  const { branch, name, version } = parseSource(source);

  const githubMatch = source.match(GITHUB_REGEX);
  if (githubMatch) {
    return fetchGitHub(githubMatch[0]).then(successful => {
      if (successful && !hasDependency([name, version])) {
        addDependency([name, version]);
      }
    });
  }

  // not github, not an URL
  // fetch pkg info from clio-lang/packages by package id (name[@version])
  return fetchFromClioPackages(source).then(successful => {
    if (successful && !hasDependency([name, version])) {
      addDependency([name, version]);
    }
  });
}

/* Fetching utils */

const logFetching = (id, version) =>
  console.log(`Downloading ${id}` + (version ? `@${version}` : "") + "...");

/**
 * Fetch a file and decompress it in the Clio environment
 *
 * @param {object} argv
 * @param {string} argv.url - url to fetch
 * @returns {void}
 */

async function fetchZipContent({ url }) {
  try {
    const file = await fetch(url);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tmpobj = tmp.fileSync();
    fs.writeFileSync(tmpobj.name, buffer, "binary");
    await decompress(tmpobj.name, ENV_NAME);
    tmpobj.removeCallback();
  } catch (err) {
    console.log(err);
    return false;
  }

  return true;
}

/**
 * Fetches library info from official repo
 * then fetches the library from GitHub and saves
 * the dependency reference into the Package.json file.
 *
 * @param {string} pkg - package name eventually followed by tag name (for example name@v2.2.3)
 * @returns {void}
 */

async function fetchFromClioPackages(pkg) {
  const { branch, name, version } = parseSource(pkg);

  console.log(
    `Getting '${name}' from the Clio packages repository (https://github.com/clio-lang/packages)`
  );
  const file = await fetch(
    `https://raw.githubusercontent.com/clio-lang/packages/master/packages/${name}.json`
  );

  if (file.status != 200) {
    console.log(`Couldn't fetch package info`);
    return false;
  }

  const packageInfo = await file.json();
  const packageUri = packageInfo.git;

  const fetchUrl = `${packageUri}/archive/${branch}.zip`;

  logFetching(name, version);

  return fetchZipContent({ url: fetchUrl });
}

/**
 * Fetches a library from GitHub and saves
 * the dependency reference into the Package.json file.
 *
 * @param {string} pkg - github uri of the package to be fetched
 * @returns {void}
 */

async function fetchGitHub(pkg) {
  /**
   * Check if required package exposes a specific
   * version or not.
   *
   * Specific version must be exposed the following way:
   *
   * $ clio deps get github.com/foo/bar@1.2.3
   *
   * Specific version has to be downloaded in the following format:
   *
   * https://github.com/foo/bar/archive/1.2.3.zip
   *
   * If no version is specified, download from master branch:
   *
   * https://github.com/foo/bar/archive/master.zip
   *
   */

  const { branch, name, version } = parseSource(pkg);

  /**
   * So now let's create a download uri that will look as follows:
   *
   * https://github.com/archive/foo/bar/{master|@1.2.3}.zip
   */
  const fetchUrl = `https://${name}/archive/${branch}.zip`;

  console.log(fetchUrl);

  logFetching(name, version);

  return fetchZipContent({ url: fetchUrl });
}

module.exports = {
  fetchDependencies,
  getPackageDependencies,
  getVersion,
  hasClioDependencies,
  hasVersion,
  installDependency
};
