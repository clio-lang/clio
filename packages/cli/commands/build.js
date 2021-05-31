const fs = require("fs");
const path = require("path");
const { compile } = require("clio-core");
const { error, info, warn } = require("../lib/colors");
const { getPlatform } = require("../lib/platforms");
const { Progress } = require("../lib/progress");

const {
  ENV_NAME,
  fetchNpmDependencies,
  getPackageConfig,
  hasInstalledNpmDependencies,
  getParsedNpmDependencies,
  getParsedNpmDevDependencies,
  makeStartScript,
} = require("clio-manifest");

const asyncCompile = async (...args) => compile(...args);

const flatten = (arr) => arr.reduce((acc, val) => acc.concat(val), []);

const isDir = (dir) => fs.lstatSync(dir).isDirectory();
const readDir = (dir) => fs.readdirSync(dir);
const walkDir = (dir) => readDir(dir).map((f) => walk(path.join(dir, f)));
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
      if (fs.existsSync(absTarget)) copyDir(absTarget, destPath);
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

function getDestinationFromConfig(configPath, config) {
  if (!config) {
    throw new Error('You must pass the location of the "clio.toml" file.');
  }

  if (!config.build) {
    throw new Error(
      `No build configuration has been found. Please add a [build] section to your "${configPath}" file.`
    );
  }

  if (!config.build.destination) {
    throw new Error(
      `The build directory is missing on your "${configPath}".\n\nExample:\n\n[build]\ndestination = "build"\n`
    );
  }

  return config.build.destination;
}

// FIXME I'm not sure if this function should stay here
function getBuildTarget(configPath, config) {
  if (!config) {
    throw new Error('You must pass the location of the "clio.toml" file.');
  }

  if (!config.build) {
    throw new Error(
      `No build configuration has been found. Please add a [build] section to your "${configPath}" file.`
    );
  }

  if (!config.build.target) {
    throw new Error(`"target" field is missing in your "${configPath}" file.`);
  }

  return config.build.target;
}

function getSourceFromConfig(configPath, config) {
  if (!config.build) {
    throw new Error(
      `No build configuration has been found. It is a "[build]" section on your "${configPath}" file.`
    );
  }

  if (!config.build.source) {
    throw new Error(
      `Could not find a source directory for build in your ${configPath} file.`
    );
  }

  return config.build.source;
}

/**
 * Generates a package.json for a clio module.
 * Reads the configuration file of the module and builds a package.json file containing all nessessary fields
 *
 * @param {string} source source root directory of clio project
 * @param {string} dependency name of the dependency being compiled
 * @param {string} destination destination for package.json
 */
const buildPackageJson = (source, dependency, destination) => {
  const configPath = path.join(source, ENV_NAME, dependency, "clio.toml");
  const config = getPackageConfig(configPath);
  const packageJson = {
    main: config.main,
    title: config.title,
    clio: { config },
  };
  const destFilePath = path.join(
    destination,
    "node_modules",
    path.basename(dependency),
    "package.json"
  );
  fs.writeFileSync(destFilePath, JSON.stringify(packageJson));
};

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

  if (!silent) info(`Creating build for target "${target}"`);

  if (clean && fs.existsSync(destination)) {
    if (!silent) info(`Wiping the build directory`);
    fs.rmSync(destination, { recursive: true });
  }

  const progress = new Progress(silent);
  try {
    progress.start("Compiling source...");

    // Build source
    const files = getClioFiles(sourceDir);
    for (const file of files) {
      const relativeFile = path.relative(sourceDir, file);
      const destFileClio = path.join(destination, relativeFile);
      const destFile = `${destFileClio}.js`;
      const destDir = path.dirname(destFile);
      const contents = fs.readFileSync(file, "utf8");
      const { code, map } = await asyncCompile(contents, relativeFile).catch(
        (compileError) => {
          console.error(compileError.message);
          process.exit(1);
        }
      );
      mkdir(destDir);
      await fs.promises.writeFile(destFileClio, contents, "utf8");
      await fs.promises.writeFile(destFile, code, "utf8");
      await fs.promises.writeFile(`${destFile}.map`, map, "utf8");
    }

    mkdir(path.join(destination, ".clio"));
    progress.succeed();

    // Add index.js file
    progress.start("Adding Clio start script...");
    makeStartScript(config, target, destination);
    progress.succeed();

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
        dependencies,
        devDependencies,
        ...config.npmOverride,
      };
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJsonContent, null, 2),
        { flag: "w" }
      );

      if (!skipNpmInstall) {
        progress.start(
          "Installing npm dependencies (this may take a while)..."
        );
        await fetchNpmDependencies(destination, silent);
        progress.succeed();
      }
    } catch (e) {
      console.trace(e);
      progress.fail(`Error: ${e.message}`);
      error(e, "Dependency Install");
      // process.exit(4);
    }

    // Build clio deps
    // TODO: FIXME
    if (fs.existsSync(path.join(sourceDir, ENV_NAME))) {
      progress.start("Compiling Clio dependencies...");
      const files = getClioFiles(path.join(sourceDir, ENV_NAME));
      for (const file of files) {
        const relativeFile = path.relative(sourceDir, file);
        const destFileClio = path
          .join(destination, relativeFile)
          .replace(ENV_NAME, "node_modules");
        const destFile = `${destFileClio}.js`;
        const contents = await fs.promises.readFile(file, "utf8");
        const { code, map } = await asyncCompile(contents, relativeFile).catch(
          (compileError) => {
            console.error(compileError.message);
            process.exit(1);
          }
        );
        const destDir = path.dirname(destFile);
        mkdir(destDir);
        await fs.promises.writeFile(destFileClio, contents, "utf8");
        await fs.promises.writeFile(destFile, code, "utf8");
        await fs.promises.writeFile(`${destFile}.map`, map, "utf8");
      }
      progress.succeed();

      // Build package.json files
      progress.start("Linking Clio dependencies...");
      const clioDepDirs = fs.readdirSync(path.join(sourceDir, ENV_NAME));
      for (const depDir of clioDepDirs) {
        buildPackageJson(sourceDir, depDir, destination);
      }
      progress.succeed();
    }
  } catch (e) {
    progress.fail(`Error: ${e}`);
    error(e, "Compilation");
    // process.exit(3);
  }

  const nonClioFiles = getNonClioFiles(sourceDir);
  for (const file of nonClioFiles) {
    const relativeFile = path.relative(sourceDir, file);
    const destFile = path.join(destination, relativeFile);
    const destDir = path.dirname(destFile);
    mkdir(destDir);
    await fs.promises.copyFile(file, destFile);
  }

  if (!skipNpmInstall && !hasInstalledNpmDependencies(destination)) {
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
    rmdir(path.join(destination, "node_modules", "clio-run"));
    await link(
      path.resolve(process.env.CLIOPATH, "packages", "run"),
      path.join(destination, "node_modules", "clio-run")
    );
    rmdir(path.join(destination, "node_modules", "clio-rpc"));
    await link(
      path.resolve(process.env.CLIOPATH, "packages", "rpc"),
      path.join(destination, "node_modules", "clio-rpc")
    );
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
async function link(source, destination) {
  await copyDir(source, destination);
}

const command = "build [config]";
const desc = "Build a Clio project";

const handler = (argv) => {
  const options = {
    skipBundle: argv["skip-bundle"],
    skipNpmInstall: argv["skip-npm-install"],
    silent: argv.silent,
  };
  const configs = isDir(argv.config)
    ? fs.readdirSync(argv.config).filter(isClioConfig)
    : [argv.config];
  if (!configs.length)
    error(new Error(`No config file found in ${argv.config}`));
  for (const config of configs) build(config, options);
};
const builder = {
  config: {
    describe: "Config file, or a directory to read configs from.",
    type: "string",
    default: path.resolve("."),
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
