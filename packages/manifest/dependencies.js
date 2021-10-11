import { addDependency, getPackageConfig } from "./packageConfig.js";

import { fetchPackageFromGit } from "./utils/fetch.js";
import { installNpmDependency } from "./npm_dependencies.js";
import { parsePackageId } from "./utils/parse.js";

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
export function getPackageDependencies(configPath) {
  const config = getPackageConfig(configPath);
  return config.dependencies;
}

/**
 * Returns true if the project has at least one dependency listed in the package
 * config file.
 * @returns {bool}
 */
export function hasClioDependencies(configPath) {
  const dependencies = getPackageDependencies(configPath);
  return !!dependencies && !!Object.keys(dependencies).length;
}

export const logNoClioDeps = (configPath) =>
  console.log(`No dependencies found in ${configPath}`);

/* Dependency fetching */

/**
 * Installs every dependency listed in project manifest
 *
 * @returns {void|promise}
 */
export function fetchDependencies(configPath) {
  if (!hasClioDependencies(configPath)) {
    logNoClioDeps(configPath);
    return;
  }

  return Promise.all(
    getPackageDependencies(configPath).map((dep) =>
      installDependency(configPath, `${dep.name}@${dep.version}`)
    )
  );
}

/* Dependency installation */

/**
 * Install a Clio dependency
 *
 * @param {string} configPath - path to the clio.toml config file
 * @param {string} id - git url and tag (url[@tag]) of the package to fetch
 * @param {object} flags - install command flags
 * @returns {promise}
 */
export async function installDependency(configPath, id, flags = {}) {
  if (flags.npm) {
    return installNpmDependency(configPath, id, flags);
  }
  const { url, tag } = parsePackageId(id);
  const dependencyCfg = await fetchPackageFromGit(
    configPath,
    { url, tag },
    flags.force
  );
  addDependency(configPath, [url, tag]);
  // install dependencies of dependencies, and their dependencies
  const toInstall = [];
  const queueDeps = (cfg) => {
    for (const { name, version } of cfg.dependencies || []) {
      toInstall.push({ url: name, tag: version });
    }
  };
  queueDeps(dependencyCfg);
  while (toInstall.length) {
    const { url, tag } = toInstall.pop();
    const dependencyCfg = await fetchPackageFromGit(
      configPath,
      { url, tag },
      flags.force
    );
    queueDeps(dependencyCfg);
  }
}

export default {
  fetchDependencies,
  getPackageDependencies,
  hasClioDependencies,
  installDependency,
  logNoClioDeps,
};
