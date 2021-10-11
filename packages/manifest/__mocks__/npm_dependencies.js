import { existsSync, promises } from "fs";

import { getPackageConfig } from "../packageConfig.js";
import { join } from "path";

const fetchNpmDependencies = jest
  .fn()
  .mockImplementation(async (destination) => {
    console.log("Getting mock NPM dependencies...");
    const fakeModulePath = join(destination, "node_modules", "rickroll");
    await promises.mkdir(fakeModulePath, { recursive: true });
    return promises.writeFile(
      join(fakeModulePath, "rickroll.js"),
      "console.log()",
      {}
    );
  });

function hasInstalledNpmDependencies(destination) {
  return existsSync(join(destination, "package-lock.json"));
}

function getParsedNpmDependencies(configPath) {
  const dependencies = {};
  const npmDependencies = getPackageConfig(configPath).npm.dependencies;
  if (npmDependencies) {
    npmDependencies.forEach((dep) => {
      dependencies[dep.name] = dep.version;
    });
  }
  return dependencies;
}

function getParsedNpmDevDependencies(configPath) {
  const dependencies = {};
  const npmDevDependencies = getPackageConfig(configPath).npm.devDependencies;
  if (npmDevDependencies) {
    npmDevDependencies.forEach((dep) => {
      dependencies[dep.name] = dep.version;
    });
  }
  return dependencies;
}

export default {
  fetchNpmDependencies,
  hasInstalledNpmDependencies,
  getParsedNpmDependencies,
  getParsedNpmDevDependencies,
};
