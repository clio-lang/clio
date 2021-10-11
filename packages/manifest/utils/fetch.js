import { basename, join, resolve } from "path";
import { existsSync, rmSync } from "fs";

import { MODULES_PATH } from "../config.js";
import { execSync } from "child_process";
import { getPackageConfig } from "../packageConfig.js";

/**
 * Fetches a library zip archive from GitHub and saves its reference
 * into the package config file.
 *
 * @param {string} pkg - github uri of the package to be fetched
 * @returns {Promise}
 */
export async function fetchPackageFromGit(configPath, { url, tag }, force) {
  const cfg = getPackageConfig(configPath);
  const source = resolve(cfg.build.source, MODULES_PATH);
  const packageName = basename(url).replace(/\.git$/, "") + `@${tag}`;
  const packagePath = join(source, packageName);
  if (existsSync(packagePath)) {
    if (force) {
      rmSync(packagePath, { recursive: true });
    } else {
      return getPackageConfig(join(packagePath, "clio.toml"));
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
    rmSync(join(packagePath, ".git"), { recursive: true });
  } catch (error) {
    rmSync(packagePath, { recursive: true });
    throw `Failed to checkout ${tag}`;
  }
  return getPackageConfig(join(packagePath, "clio.toml"));
}

export default {
  fetchPackageFromGit,
};
