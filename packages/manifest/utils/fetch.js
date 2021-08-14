const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { getPackageConfig } = require("../packageConfig");

const { MODULES_PATH } = require("../config");

/**
 * Fetches a library zip archive from GitHub and saves its reference
 * into the package config file.
 *
 * @param {string} pkg - github uri of the package to be fetched
 * @returns {Promise}
 */
async function fetchPackageFromGit(configPath, { url, tag }, force) {
  const cfg = getPackageConfig(configPath);
  const source = path.resolve(cfg.build.source, MODULES_PATH);
  const packageName = path.basename(url).replace(/\.git$/, "") + `@${tag}`;
  const packagePath = path.join(source, packageName);
  if (fs.existsSync(packagePath)) {
    if (force) {
      fs.rmSync(packagePath, { recursive: true });
    } else {
      return getPackageConfig(path.join(packagePath, "clio.toml"));
    }
  }
  try {
    console.log(`Cloning into ${packageName}...`);
    execSync(`git clone ${url} ${packagePath}`, { stdio: "ignore" });
  } catch (error) {
    throw `Failed to clone ${url}@${tag}!`;
  }
  try {
    execSync(`git checkout ${tag}`, { cwd: packagePath, stdio: "ignore" });
    fs.rmSync(path.join(packagePath, ".git"), { recursive: true });
  } catch (error) {
    fs.rmSync(packagePath, { recursive: true });
    throw `Failed to checkout ${tag}`;
  }
  return getPackageConfig(path.join(packagePath, "clio.toml"));
}

module.exports = {
  fetchPackageFromGit,
};
