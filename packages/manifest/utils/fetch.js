const fs = require("fs");

const decompress = require("decompress");
const tmp = require("tmp");
const fetch = require("node-fetch");

const { ENV_NAME } = require("../config");
const { githubZipURL } = require("./url");

const logFetching = (id, version) =>
  console.log(`Downloading ${id}` + (version ? `@${version}` : "") + "...");

/**
 * Fetch a file and decompress it in the Clio environment
 *
 * @param {object} argv
 * @param {string} argv.url - url to fetch
 * @returns {void}
 */
async function fetchZipArchive(url) {
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
 * Fetches library info from the registry then fetches the library from GitHub
 * and saves the dependency reference into the package config file.
 *
 * @param {object} obj
 * @param {string} obj.branch - branch name
 * @param {string} obj.name - package name
 * @example

fetchFromClioPackages({branch: 'master', name: 'stdlib'})
fetchFromClioPackages({branch: 'v2.3.3', name: 'rethinkdb'})
 * @returns {void}
 */
async function fetchFromClioPackages({ branch, name }) {
  console.log(
    `Getting '${name}' from the Clio packages repository (https://github.com/clio-lang/packages)`
  );

  const file = await fetch(
    `https://raw.githubusercontent.com/clio-lang/packages/master/packages/${name}.json`
  );
  if (file.status !== 200) {
    console.log(`Couldn't fetch package info`);
    return false;
  }

  const packageInfo = await file.json();
  const archiveURL = githubZipURL({ branch, uri: packageInfo.git });

  logFetching(name, branch);

  return fetchZipArchive(archiveURL);
}

/**
 * Fetches a library zip archive from GitHub and saves its reference
 * into the package config file.
 *
 * @param {string} pkg - github uri of the package to be fetched
 * @returns {void}
 */
async function fetchGitHubZipArchive({ branch, uri }) {
  const archiveURL = githubZipURL({ branch, uri });

  logFetching(uri, branch);

  return fetchZipArchive(archiveURL);
}

module.exports = {
  fetchFromClioPackages,
  fetchGitHubZipArchive,
  fetchZipArchive,
  logFetching,
};
