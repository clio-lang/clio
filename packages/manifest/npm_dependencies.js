import { addNpmDependency, getPackageConfig } from "./packageConfig.js";

import { existsSync } from "fs";
import { join } from "path";
import { json } from "npm-registry-fetch";
import { spawn } from "child_process";

export function fetchNpmDependencies(destination, silent = false) {
  return new Promise((resolve, reject) => {
    const args = ["install"];
    if (silent) args.push("--silent");
    const npm = process?.platform == "win32" ? "npm.cmd" : "npm";
    const install = spawn(npm, args, { cwd: destination });
    install.on("close", resolve);
    install.on("error", reject);
  });
}

export function hasInstalledNpmDependencies(destination) {
  return existsSync(join(destination, "package-lock.json"));
}

export function getParsedNpmDependencies(configPath) {
  const dependencies = {};
  const npmDependencies = getPackageConfig(configPath).npm.dependencies;
  if (npmDependencies) {
    npmDependencies.forEach((dep) => {
      dependencies[dep.name] = dep.version;
    });
  }
  return dependencies;
}

export function getParsedNpmDevDependencies(configPath) {
  const dependencies = {};
  const npmDevDependencies = getPackageConfig(configPath).npm.devDependencies;
  if (npmDevDependencies) {
    npmDevDependencies.forEach((dep) => {
      dependencies[dep.name] = dep.version;
    });
  }
  return dependencies;
}

export async function installNpmDependency(configPath, id, flags) {
  const [_, org, name, tag] = id.match(/^(?:@([^/]+)\/)?([^@]+)(?:@(.*))?/);
  const pkg = org ? `@${org}/${name}` : name;
  const info = await json(pkg).catch((err) => err);
  if (info.statusCode == 404)
    throw new Error(`Couldn't fetch package info for ${id}`);
  const selected = info["dist-tags"][tag || "latest"];
  addNpmDependency(configPath, [info.name, selected], flags);
}

export default {
  fetchNpmDependencies,
  hasInstalledNpmDependencies,
  getParsedNpmDependencies,
  getParsedNpmDevDependencies,
  installNpmDependency,
};
