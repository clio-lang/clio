const decompress = require("decompress");
const tmp = require("tmp");
const fs = require("fs");
const fetch = require("node-fetch");
const {
  updatePackageJsonDependencies,
  getClioDependencies
} = require("../helpers/package");

const gitHubRegex = /github\.com\/(\w|\d|_|-).+\/(\d|\w|-|_).+/gi;
const urlRegex = /https?:\/\/.+/gi;
const versionRegex = /@(\d\.?){1,3}$/gi;

/**
 * @method get
 * @param {object} argv
 * @param {object} argv.url - url to fetch
 * @returns {void}
 * @description Installs a Clio dependency
 */

function get({url}) {
  // url first (could also be a github zip url)
  const urlMatch = url.match(urlRegex);
  if (urlMatch) {
    return fetchZipContent({url: urlMatch[0]});
  }

  const githubMatch = url.match(gitHubRegex);
  if (githubMatch) {
    return fetchGitHub(githubMatch[0]);
  }

  // not github, not an URL
  // fetch pkg info from clio-lang/packages by package name
  return fetchFromClioPackages(url);
}

/**
 * @method fetchZipContent
 * @param {object} argv
 * @param {object} argv.url - url to fetch
 * @returns {void}
 * @description Fetch a file and decompress it in the Clio environment
 */

async function fetchZipContent({url}) {
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
 * @method fetchFromClioPackages
 * @param {string} pkg - package URL
 * @returns {void}
 * @description Fetches library info from official repo
 *              then fetches the library from GitHub and saves
 *              the dependency reference into the Package.json file.
 */

async function fetchFromClioPackages(pkg) {
  const packageName = hasVersion(pkg) ? pkg.replace(versionRegex, "") : pkg;

  const packageTarget = hasVersion(pkg)
    ? getVersion(pkg).replace("@", "")
    : "master";

  console.log(`Getting '${packageName}' from the Clio packages repository (see https://github.com/clio-lang/packages)`);
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
  await fetchZipContent({ url: fetchUrl });

  /**
   * If the dependency is already listed in package.json
   * don't update it.
   */
  if (!getClioDependencies().includes(pkg)) {
    updatePackageJsonDependencies(pkg)
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
   *
   * Specific version must be exposed the following way:
   *
   * $ clio deps get github.com/foo/bar@1.2.3
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
  await fetchZipContent({ url: fetchUrl });

  /**
   * If the dependency is already listed in package.json
   * don't update it.
   */
  if (!getClioDependencies().includes(argv)) {
    updatePackageJsonDependencies(argv)
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
  get,
  hasVersion,
  getVersion
};
