const fs = require("fs");
const path = require("path");
const { compileFile } = require("clio-core");
const { error, info, warn } = require("../lib/colors");
const { getPlatform, npmCommand } = require("../lib/platforms");
const { Progress } = require("../lib/progress");

const {
  fetchNpmDependencies,
  getPackageConfig,
  getParsedNpmDependencies,
  getParsedNpmDevDependencies,
  makeStartScript,
  getDestinationFromConfig,
  getBuildTarget,
  getSourceFromConfig,
  MODULES_PATH,
} = require("clio-manifest");

const flatten = (arr) => arr.reduce((acc, val) => acc.concat(val), []);

const isDir = (dir) => fs.lstatSync(dir).isDirectory();
const readDir = (dir) => fs.readdirSync(dir);
const walkDir = (dir) =>
  readDir(dir)
    .filter((name) => name !== ".clio")
    .map((f) => walk(path.join(dir, f)));
const walk = (dir) => (isDir(dir) ? flatten(walkDir(dir)) : [dir]);

const isClioFile = (file) => file.endsWith(".clio");
const isClioConfig = (file) => file.match(/(^|[.\\])clio\.toml$/);
const isNotClioFile = (file) => !isClioFile(file);
const getClioFiles = (dir) => walk(dir).filter(isClioFile);
const getNonClioFiles = (dir) => walk(dir).filter(isNotClioFile);

const copyDir = async (src, dest) => {
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  mkdir(dest);
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(srcPath);
      const absTarget = path.isAbsolute(target)
        ? target
        : path.resolve(path.dirname(srcPath), target);
      fs.symlinkSync(absTarget, destPath);
    } else if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.promises.copyFile(
        srcPath,
        destPath,
        fs.constants.COPYFILE_FICLONE
      );
    }
  }
};

const rmdir = (directory) => {
  if (fs.existsSync(directory)) fs.rmSync(directory, { recursive: true });
};

const mkdir = (directory) => {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
};

const asyncCompile = async (...args) => compileFile(...args);

/**
 *
 * @param {string} configPath Path to the project config file
 * @param {Object} options Options to build
 */
const build = async (configPath, options = {}) => {
  const { skipBundle, skipNpmInstall, silent, clean } = options;

  if (!silent) info(`Compiling from "${configPath}"`);

  const config = getPackageConfig(configPath);
  const target = getBuildTarget(configPath, config);
  const destination = getDestinationFromConfig(configPath, config);
  const sourceDir = getSourceFromConfig(configPath, config);

  const modulesDir = path.join(sourceDir, MODULES_PATH);
  const modulesDestDir = path.join(destination, MODULES_PATH);

  if (!silent) info(`Creating build for target "${target}"`);

  if (clean && fs.existsSync(destination)) {
    if (!silent) info(`Wiping the build directory`);
    fs.rmSync(destination, { recursive: true });
  }

  const progress = new Progress(silent);
  progress.start("Compiling from source...");

  const result = await asyncCompile(
    "main.clio",
    config,
    configPath,
    modulesDir,
    modulesDestDir,
    "",
    "",
    path.join(destination, ".clio", "cache"),
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
      const relativeFile = path.relative(sourceDir, file);
      const destFile = path.join(destination, relativeFile);
      const destDir = path.dirname(destFile);
      mkdir(destDir);
      await fs.promises.copyFile(file, destFile);
    }
    progress.succeed();

    // Add index.js file
    progress.start("Adding Clio start script...");
    mkdir(path.join(destination, ".clio"));
    makeStartScript(config, target, destination);
    progress.succeed();

    const { npmDeps } = result;

    const depsNpmDependencies = Object.values(npmDeps).reduce(
      (lhs, rhs) => ({ ...lhs, ...rhs }),
      {}
    );

    // Init npm modules
    try {
      const packageJsonPath = path.join(destination, "package.json");
      const dependencies = getParsedNpmDependencies(configPath);

      const devDependencies = getParsedNpmDevDependencies(configPath);
      dependencies["clio-run"] = "latest";
      const packageInfo = {};
      if (config.keywords) packageInfo.keywords = config.keywords;
      if (config.authors) packageInfo.authors = config.authors;
      const packageJsonContent = {
        ...packageInfo,
        main: `./main.clio.js`,
        dependencies: { ...depsNpmDependencies, ...dependencies },
        devDependencies,
        ...config.npmOverride,
      };
      fs.writeFileSync(
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
async function link(name, internalName, destination, unlinks = []) {
  const modulePath = path.join(destination, "node_modules", name);
  const internalPath = path.resolve(
    process.env.CLIOPATH,
    "packages",
    internalName
  );
  rmdir(modulePath);
  await copyDir(internalPath, modulePath);
  unlinkNodeModules(modulePath, ...unlinks);
}

/**
 * Install external package into destination
 * @param {string} destination Full path to destination directory
 */
function installExternal(name, destination) {
  return npmCommand("install", destination, [name], { stdio: "ignore" });
}

/**
 * Unlink local internals package as a dependency
 * @param {string} destination Full path to destination directory
 */
function unlinkNodeModules(destination, ...names) {
  for (const name of names) {
    fs.rmSync(path.join(destination, "node_modules", name), {
      recursive: true,
    });
  }
}

const command = "build [project]";
const desc = "Build a Clio project";

const handler = (argv) => {
  const options = {
    skipBundle: argv["skip-bundle"],
    skipNpmInstall: argv["skip-npm-install"],
    silent: argv.silent,
  };
  const config = path.join(argv.project, "clio.toml");
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

module.exports = {
  build,
  command,
  desc,
  builder,
  handler,
  getBuildTarget,
  getDestinationFromConfig,
  copyDir,
  isClioConfig,
  isDir,
};
