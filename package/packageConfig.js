const path = require("path");
const fs = require("fs");
const toml = require("@iarna/toml");
const decompress = require("decompress");
const tmp = require("tmp");
const fetch = require("node-fetch");

const configFileName = "clio.toml";

/**
 *
 * @param {string} filepath Optional name of file containing the configurations for the clio package in format `foo.toml`.
 */
function getPackageConfig(filepath = path.join(process.cwd(), configFileName)) {
  const file = fs.readFileSync(filepath);
  const config = toml.parse(file);

  const parsedConfig = {
    title: config.title,
    description: config.description,
    version: config.version,
    license: config.license,
    main: config.main,
    authors: config.authors,
    keywords: config.keywords,
    build: config.build,
    target: config.target,
    // eslint-disable-next-line camelcase
    git_repository: config.git_repository,
    documentation: config.documentation,
    scripts: config.scripts
  };

  if (config.dependencies) {
    parsedConfig.dependencies = Object.entries(config.dependencies).map(dep => {
      return { name: dep[0], version: dep[1] };
    });
  }

  if (config.npm_dependencies) {
    // eslint-disable-next-line camelcase
    parsedConfig.npm_dependencies = Object.entries(config.npm_dependencies).map(
      dep => {
        return { name: dep[0], version: dep[1] };
      }
    );
  }

  return parsedConfig;
}

function writePackageConfig(cfg, directory = process.cwd()) {
  const deps = {};
  cfg.dependencies.forEach(dep => (deps[dep.name] = dep.version));
  const cfgStr = toml.stringify({ ...cfg, dependencies: deps });
  const filePath = path.join(directory, configFileName);
  fs.writeFileSync(filePath, cfgStr);
}

/**
 *
 * @param {string[]} dep
 */
async function addDependency(dep) {
  const config = getPackageConfig();
  const depName = dep[0];
  const depVersion = dep[1];
  config.dependencies.push({ name: depName, version: depVersion });
  writePackageConfig(config);
}

function getNpmDependencies() {
  return getPackageConfig().npm_dependencies;
}

function fetchNpmDependencies(destination) {
  process.chdir(destination);
  return new Promise((resolve, reject) =>
    exec("npm install", err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    })
  );
}

/**
 * @returns {{name, version}}
 */
function getPackageDependencies() {
  const config = getPackageConfig();
  return config.dependencies;
}

/**
 * @method hasClioDependencies
 * @returns {bool}
 * @description Returns true if the project has at least one dependency listed
 *              in the Package.json file.
 */

function hasClioDependencies() {
  const dependencies = getPackageDependencies();
  return !!dependencies && !!Object.keys(dependencies).length;
}

/**
 * @method fetchDependencies
 * @returns {void}
 * @description Installs every dependency listed in
 *              package.json
 */

function fetchDependencies() {
  if (!hasClioDependencies()) {
    console.log("No dependencies found in package.json");
    return;
  }

  return Promise.all(
    getPackageDependencies().map(dep => get({ url: dep.name }))
  );
}

const gitHubRegex = /github\.com\/(\w|\d|_|-).+\/(\d|\w|-|_).+/gi;
const urlRegex = /https?:\/\/.+/gi;
const versionRegex = /@(\d\.?){1,3}$/gi;

/**
 * @method get
 * @param {string} argv
 * @returns {void}
 * @description Installs a Clio dependency
 */

function get(argv) {
  const url = argv.url;
  if (url.match(gitHubRegex)) {
    return fetchGitHub(url);
  }
  if (url.match(urlRegex)) {
    return fetchFile({ url });
  }
  // not github, not url, fetch pkg info from main repo
  return fetchFromRepo(url);
}

async function fetchFile({ url }) {
  try {
    const file = await fetch(url);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tmpobj = tmp.fileSync();
    fs.writeFileSync(tmpobj.name, buffer, "binary");
    await decompress(tmpobj.name, "clio_env");
    tmpobj.removeCallback();
  } catch (err) {
    console.log(err);
  }
}

/**
 * @method fetchFromRepo
 * @param {string} argv
 * @returns {void}
 * @description Fetches library info from official repo
 *              then fetches the library from GitHub and saves
 *              the dependency reference into the Package.json file.
 */

async function fetchFromRepo(pkg) {
  const packageName = hasVersion(pkg) ? pkg.replace(versionRegex, "") : pkg;

  const packageTarget = hasVersion(pkg)
    ? getVersion(pkg).replace("@", "")
    : "master";

  console.log(`Getting ${packageName} from main repository,`);
  const file = await fetch(
    `https://raw.githubusercontent.com/clio-lang/packages/master/packages/${packageName}.json`
  );

  if (file.status != 200) {
    return console.log(`Couldn't fetch package info`);
  }

  const packageInfo = await file.json();
  const packageUri = packageInfo.git;

  const fetchUrl = `${packageUri}/archive/${packageTarget}.zip`;

  console.log(`Downloading ${pkg}...`);
  await fetchFile({ url: fetchUrl });

  /**
   * If the dependency is already listed in package.json
   * don't update it.
   */
  if (!getPackageDependencies().includes(pkg)) {
    addDependency([pkg, "latest"])
      .then(() => console.log(`Added ${pkg} to the dependencies list`))
      .catch(err =>
        console.log(`Can not add ${pkg} to the dependencies list`, err)
      );
  }
}

/**
 * @method fetchGitHub
 * @param {string} argv
 * @returns {void}
 * @description Fetches a library from GitHub and saves
 *              the dependency reference into the Package.json file.
 */

async function fetchGitHub(argv) {
  /**
   * Check if required package exposes a specific
   * version or not.
   * Specific version must be exposed the following way:
   *
   * $ clio get github.com/foo/bar@1.2.3
   *
   * Specific version has to be downloaded in the following format:
   *
   *  https://github.com/foo/bar/archive/1.2.3.zip
   *
   * If no version is specified, download from master branch:
   *
   * https://github.com/foo/bar/archive/master.zip
   *
   */
  const packageTarget = hasVersion(argv)
    ? getVersion(argv).replace("@", "")
    : "master";

  const packageUri = hasVersion(argv) ? argv.replace(versionRegex, "") : argv;

  /**
   * So now let's create a download uri that will look as follows:
   *
   * https://github.com/archive/foo/bar/{master|@1.2.3}.zip
   */
  const fetchUrl = `https://${packageUri}/archive/${packageTarget}.zip`;

  console.log(`Downloading ${argv}...`);
  await fetchFile({ url: fetchUrl });

  /**
   * If the dependency is already listed in package.json
   * don't update it.
   */
  if (!getPackageDependencies().includes(argv)) {
    addDependency([argv, "latest"])
      .then(() => console.log(`Added ${argv} to the dependencies list`))
      .catch(err =>
        console.log(`Can not add ${argv} to the dependencies list`, err)
      );
  }
}

/**
 * @method getVersion
 * @param {string} argv
 * @returns {string}
 * @description Gets the version number (if any) of the
 *              desidered dependency.
 */

function getVersion(argv) {
  const matches = argv.match(versionRegex);
  return matches ? matches[0] : "";
}

/**
 * @method hasVersion
 * @param {string} argv
 * @returns {boolean}
 * @description Returns true when the desidered dependency
 *              specifies a version.
 */

function hasVersion(argv) {
  return !!getVersion(argv).length;
}

module.exports = {
  getPackageConfig,
  writePackageConfig: writePackageConfig,
  addDependency,
  getPackageDependencies,
  getNpmDependencies,
  configFileName,
  hasClioDependencies,
  fetchDependencies,
  fetchNpmDependencies,
  get,
  getVersion,
  hasVersion
};
