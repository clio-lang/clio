const decompress = require('decompress');
const tmp = require('tmp');
const fs = require('fs');
const fetch = require("node-fetch");

const gitHubRegex = /^github\.com\/(\w|\d|_|-).+\/(\d|\w|-|_).+$/gi;
const versionRegex = /@(\d\.?){1,3}$/gi;

async function get(argv) {
  return gitHubRegex.test(argv) 
         ? fetchGitHub(argv) 
         : fetchFile(argv)
}

async function fetchFile(argv) {
  const url = argv.url;
  const file = await fetch(url);
  const array_buffer = await file.arrayBuffer();
  const buffer = Buffer.from(array_buffer);
  const tmpobj = tmp.fileSync();
  fs.writeFileSync(tmpobj.name, buffer, 'binary');
  await decompress(tmpobj.name, 'clio_env')
  tmpobj.removeCallback();
}

/**
 * @method fetchGitHub
 * @param {string} argv
 * @returns {void} 
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

  const packageUri = hasVersion(argv)
                   ? argv.replace(versionRegex, "")
                   : argv

  /**
   * So now let's create a download uri that will look as follows:
   * 
   * https://github.com/archive/foo/bar/{master|@1.2.3}.zip
   */
  const fetchUrl = `https://${packageUri}/archive/${packageTarget}.zip`;
  

  process.stdout.write(`Downloading ${fetchUrl}...`);
  
  fetchFile({url: fetchUrl});
}

/**
 * @method getVersion
 * @param {string} argv
 * @returns {string}
 */

function getVersion(argv) {
  const matches = argv.match(versionRegex)
  return matches 
       ? matches[0] 
       : ""
}

/**
 * @method hasVersion
 * @param {string} argv
 * @returns {boolean} 
 */

function hasVersion(argv) {
  return !!getVersion(argv).length
}

get("github.com/micheleriva/mjn")