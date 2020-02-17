const { GITHUB_PREFIX, REGISTRY_NAME, URL_PREFIX } = require("../config");

// see https://docs.clio-lang.org/v/develop/development/dependency_parser
const GITHUB_ZIP_RE = /(github\.com\/((?:(?:\w|\d|_|-)+\/(?:\w|\d|_|-)+){1}))\/archive\/(?:v((?:\d\.?){1,3})|((?:\w|\d|_|-)+))(?:\.zip)$/i;
const GITHUB_URI_RE = /(github\.com\/((?:(?:\w|\d|_|-)+\/(?:\w|\d|_|-)+){1}))(?:@(?:((?:\d\.?){1,3})|((?:\w|\d|_|-)+)))?$/i;
const GITHUB_PATH_RE = /^((?:(?:\w|\d|_|-)+\/(?:\w|\d|_|-)+){1})(?:@(?:((?:\d\.?){1,3})|((?:\w|\d|_|-)+)))?$/i;
const NAME_RE = /^((?:\w|\d|_|-)+)(?:@(?:((?:\d\.?){1,3})|((?:\w|\d|_|-)+)))?$/i;
const URL_RE = /https?:\/\/.+/gi;

const prefixes = `${GITHUB_PREFIX}|${REGISTRY_NAME}|${URL_PREFIX}`;
const prefixRegex = new RegExp(`(${prefixes}):(.+)`, "i");

/**
 * Returns an object whose properties represent significant elements
 * of the provided string.
 *
 * @param {string} id
 * @returns {object}
 *
 * @example (see tests)
 */
const parsePackageId = input => {
  let parsed = { input };
  let id = input;

  const prefixExec = prefixRegex.exec(input);
  if (prefixExec) {
    id = prefixExec[2];
  }

  // also valid for url:*
  const urlMatch = id.match(URL_RE);
  if (urlMatch) {
    parsed.source = `${URL_PREFIX}:${urlMatch[0]}`;
    parsed.url = urlMatch[0];
    parsed.registry = "url";

    const ghZipExec = GITHUB_ZIP_RE.exec(id);
    if (ghZipExec) {
      return {
        ...parsed,
        branch: ghZipExec[3] ? `v${ghZipExec[3]}` : ghZipExec[4] || "master",
        githubPath: ghZipExec[2],
        githubURI: ghZipExec[1],
        isVersioned: !!ghZipExec[3],
        name: ghZipExec[2],
        source: `${GITHUB_PREFIX}:${ghZipExec[2]}`,
        version: ghZipExec[3] || "latest",
        registry: "github"
      };
    }

    return parsed;
  }

  const ghUriExec = GITHUB_URI_RE.exec(id);
  if (ghUriExec) {
    return {
      ...parsed,
      branch: ghUriExec[3] ? `v${ghUriExec[3]}` : ghUriExec[4] || "master",
      githubPath: ghUriExec[2],
      githubURI: ghUriExec[1],
      isVersioned: !!ghUriExec[3],
      name: ghUriExec[2],
      source: `${GITHUB_PREFIX}:${ghUriExec[2]}`,
      version: ghUriExec[3] || "latest",
      registry: GITHUB_PREFIX
    };
  }

  // also valid for github:*
  const ghPathExec = GITHUB_PATH_RE.exec(id);
  if (ghPathExec) {
    return {
      ...parsed,
      branch: ghPathExec[2] ? `v${ghPathExec[2]}` : ghPathExec[3] || "master",
      githubPath: ghPathExec[1],
      githubURI: `github.com/${ghPathExec[1]}`,
      isVersioned: !!ghPathExec[2],
      name: ghPathExec[1],
      source: `${GITHUB_PREFIX}:${ghPathExec[1]}`,
      version: ghPathExec[2] || "latest",
      registry: GITHUB_PREFIX
    };
  }

  // also valid for hub:*
  const nameExec = NAME_RE.exec(id);
  if (nameExec) {
    return {
      ...parsed,
      branch: nameExec[2] ? `v${nameExec[2]}` : nameExec[3] || "master",
      name: nameExec[1],
      source: `${REGISTRY_NAME}:${nameExec[1]}`,
      isVersioned: !!nameExec[2],
      version: nameExec[2] || "latest",
      registry: "hub"
    };
  }
};

/**
 * Returns true if the provided string is a Clio dependency.
 * 
 * @param {string} source
 * @returns {boolean}
 * 
 * @example
isClioSource('github:foo/bar') // true
isClioSource('hub:stdlib') // true
isClioSource('stdlib') // false
 */
const isClioSource = input => prefixRegex.exec(input) !== null;

module.exports = {
  GITHUB_PATH_RE,
  GITHUB_URI_RE,
  GITHUB_ZIP_RE,
  NAME_RE,
  isClioSource,
  parsePackageId
};
