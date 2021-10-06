import {
  MODULES_PATH,
  fetchNpmDependencies,
  getBuildTarget,
  getDestinationFromConfig,
  getPackageConfig,
  getParsedNpmDependencies,
  getParsedNpmDevDependencies,
  getSourceFromConfig,
  makeStartScript,
} from "clio-manifest";
import {
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  promises,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import { dirname, isAbsolute, join, relative, resolve } from "path";
import { error, info, warn } from "../lib/colors.js";
import { getPlatform, npmCommand } from "../lib/platforms.js";

import { Progress } from "../lib/progress.js";
import { compileFile } from "clio-core";

export const flatten = (arr) => arr.reduce((acc, val) => acc.concat(val), []);

export const isDir = (dir) => lstatSync(dir).isDirectory();
export const readDir = (dir) => readdirSync(dir);
export const walkDir = (dir) =>
  readDir(dir)
    .filter((name) => name !== ".clio")
    .map((f) => walk(join(dir, f)));
export const walk = (dir) => (isDir(dir) ? flatten(walkDir(dir)) : [dir]);

export const isClioFile = (file) => file.endsWith(".clio");
export const isClioConfig = (file) => file.match(/(^|[.\\])clio\.toml$/);
export const isNotClioFile = (file) => !isClioFile(file);
export const getClioFiles = (dir) => walk(dir).filter(isClioFile);
export const getNonClioFiles = (dir) => walk(dir).filter(isNotClioFile);

export const copyDir = async (src, dest) => {
  const entries = await promises.readdir(src, { withFileTypes: true });
  mkdir(dest);
  for (let entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isSymbolicLink()) {
      const target = readlinkSync(srcPath);
      const absTarget = isAbsolute(target)
        ? target
        : resolve(dirname(srcPath), target);
      symlinkSync(absTarget, destPath);
    } else if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await promises.copyFile(srcPath, destPath, constants.COPYFILE_FICLONE);
    }
  }
};

export const rmdir = (directory) => {
  if (existsSync(directory)) rmSync(directory, { recursive: true });
};

export const mkdir = (directory) => {
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
};

export const asyncCompile = async (...args) => compileFile(...args);

/**
 *
 * @param {string} configPath Path to the project config file
 * @param {Object} options Options to build
 */
export const build = async (configPath, options = {}) => {
  const { skipBundle, skipNpmInstall, silent, clean } = options;

  if (!silent) info(`Compiling from "${configPath}"`);

  const config = getPackageConfig(configPath);
  const target = getBuildTarget(configPath, config);
  const destination = getDestinationFromConfig(configPath, config);
  const sourceDir = getSourceFromConfig(configPath, config);

  const cacheDir = join(destination, ".clio", "cache");
  const modulesDir = join(sourceDir, MODULES_PATH);
  const modulesDestDir = join(destination, MODULES_PATH);

  if (!silent) info(`Creating build for target "${target}"`);

  if (clean && existsSync(destination)) {
    if (!silent) info(`Wiping the build directory`);
    rmSync(destination, { recursive: true });
  }

  const progress = new Progress(silent);
  progress.start("Compiling from source...");

  const result = await asyncCompile(
    "main.clio",
    config,
    configPath,
    modulesDir,
    modulesDestDir,
    dirname(configPath),
    "",
    "",
    cacheDir,
    { configs: {}, npmDeps: {}, npmDevDeps: {} }
  ).catch((compileError) => {
    progress.fail();
    console.trace(compileError);
    console.error(compileError.message);
    process.exit(1);
  });

  progress.succeed();

  try {
    // Copy resources
    progress.start("Copying over the resource files...");
    const nonClioFiles = getNonClioFiles(sourceDir);
    for (const file of nonClioFiles) {
      const relativeFile = relative(sourceDir, file);
      const destFile = join(destination, relativeFile);
      const destDir = dirname(destFile);
      mkdir(destDir);
      await promises.copyFile(file, destFile);
    }
    progress.succeed();

    // Add index.js file
    progress.start("Adding Clio start script...");
    mkdir(join(destination, ".clio"));
    makeStartScript(config, target, destination);
    progress.succeed();

    const { npmDeps } = result;

    const depsNpmDependencies = Object.values(npmDeps).reduce(
      (lhs, rhs) => ({ ...lhs, ...rhs }),
      {}
    );

    // Init npm modules
    try {
      const packageJsonPath = join(destination, "package.json");
      const dependencies = getParsedNpmDependencies(configPath);

      const devDependencies = getParsedNpmDevDependencies(configPath);
      dependencies["clio-run"] = "latest";
      const packageInfo = {};
      if (config.keywords) packageInfo.keywords = config.keywords;
      if (config.authors) packageInfo.authors = config.authors;
      const packageJsonContent = {
        ...packageInfo,
        main: "./main.clio.js",
        type: "module",
        dependencies: { ...depsNpmDependencies, ...dependencies },
        devDependencies,
        ...config.npmOverride,
      };
      writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJsonContent, null, 2),
        { flag: "w" }
      );
    } catch (e) {
      progress.fail(`Error: ${e.message}`);
      error(e, "Dependency Install");
    }
  } catch (e) {
    progress.fail(`Error: ${e}`);
    error(e, "Compilation");
  }

  if (!skipNpmInstall) {
    progress.start("Installing npm dependencies (this may take a while)...");
    await fetchNpmDependencies(destination, silent);
    progress.succeed();
  }

  if (process.env.CLIOPATH) {
    // Link local internals
    warn("Using local internals. This should only be used for debug purposes.");
    warn(
      "If you encounter any unwanted behavior, unset the CLIOPATH environment variable"
    );
    progress.succeed();
    progress.start("Linking dependencies");

    // Install third party dependencies
    const install = (...names) =>
      names.forEach((name) => installExternal(name, destination));

    install("sializer", "buffer", "bufferutil", "ws");

    // Link local dependencies
    const linkToDest = (name, internalName, unlinks) =>
      link(name, internalName, destination, unlinks);

    await linkToDest("clio-run", "run", ["clio-lang-internals", "clio-rpc"]);
    await linkToDest("clio-rpc", "rpc", ["clio-lang-internals"]);
    await linkToDest("clio-lang-internals", "internals");

    progress.succeed();
  }

  try {
    const platform = getPlatform(target);
    await platform.build(destination, skipBundle);
  } catch (e) {
    error(e, "Bundling");
  }
};

/**
 * Link local internals package as a dependency
 * @param {string} destination Full path to destination directory
 */
export async function link(name, internalName, destination, unlinks = []) {
  const modulePath = join(destination, "node_modules", name);
  const internalPath = resolve(process.env.CLIOPATH, "packages", internalName);
  rmdir(modulePath);
  await copyDir(internalPath, modulePath);
  unlinkNodeModules(modulePath, ...unlinks);
}

/**
 * Install external package into destination
 * @param {string} destination Full path to destination directory
 */
export function installExternal(name, destination) {
  return npmCommand("install", destination, [name], { stdio: "ignore" });
}

/**
 * Unlink local internals package as a dependency
 * @param {string} destination Full path to destination directory
 */
export function unlinkNodeModules(destination, ...names) {
  for (const name of names) {
    rmSync(join(destination, "node_modules", name), {
      recursive: true,
    });
  }
}

const command = "build [project]";
const describe = "Build a Clio project";

export const handler = (argv) => {
  const options = {
    skipBundle: argv["skip-bundle"],
    skipNpmInstall: argv["skip-npm-install"],
    silent: argv.silent,
  };
  const config = join(argv.project, "clio.toml");
  build(config, options);
};

const builder = {
  project: {
    describe: "Project root directory, where your clio.toml file is.",
    type: "string",
    default: ".",
  },
  "skip-bundle": {
    describe: "Does not produces a bundle for browsers.",
    type: "boolean",
  },
  "skip-npm-install": {
    describe: "Skips npm install. Useful for tests.",
    type: "boolean",
  },
  silent: {
    describe: "Mutes messages from the command.",
    type: "boolean",
  },
  clean: {
    describe: "Wipe the build directory before build",
    type: "boolean",
  },
};

export default {
  build,
  command,
  describe,
  builder,
  handler,
  getBuildTarget,
  getDestinationFromConfig,
  copyDir,
  isClioConfig,
  isDir,
};
