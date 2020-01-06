const fs = require("fs");
const path = require("path");
const { format } = require("prettier");
const ora = require("ora");
const { generator } = require("../../core/generator");
const { error, info } = require("../lib/colors");
const { getPlatform } = require("../lib/platforms");

const {
  CONFIGFILE_NAME,
  fetchNpmDependencies,
  getPackageConfig,
  hasInstalledNpmDependencies,
  getParsedNpmDependencies
} = require("../../package/index");

const flatten = arr => arr.reduce((acc, val) => acc.concat(val), []);

const isDir = dir => fs.lstatSync(dir).isDirectory();
const readDir = dir => fs.readdirSync(dir);
const walkDir = dir => readDir(dir).map(f => walk(path.join(dir, f)));
const walk = dir => (isDir(dir) ? flatten(walkDir(dir)) : [dir]);

const isClioFile = file => file.endsWith(".clio");
const isNotClioFile = file => !file.endsWith(".clio");
const getClioFiles = dir => walk(dir).filter(isClioFile);
const getNonClioFiles = dir => walk(dir).filter(isNotClioFile);

const mkdir = directory => {
  const { root, dir, base } = path.parse(directory);
  const parts = [...dir.split(path.sep), base];
  return parts.reduce((parent, subdir) => {
    parent = path.join(parent, subdir);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent);
    return parent;
  }, root);
};

function getDestinationFromConfig(source, target, config) {
  if (!config) {
    throw new Error('You must pass the location of the "clio.toml" file.');
  }

  const buildConfig = config.build;
  const buildDirectory = buildConfig.directory;

  if (!buildDirectory) {
    throw new Error(
      `The build directory is missing on your "${CONFIGFILE_NAME}".\n\nExample:\n\n[build]\ndirectory = "build"\n`
    );
  }

  return path.join(source, `${buildDirectory}/${target}`);
}

// FIXME I'm not sure if this function should stay here
function getBuildTarget(targetOverride, config) {
  if (!config) {
    throw new Error('You must pass the location of the "clio.toml" file.');
  }
  const buildConfig = config.build;

  if (!buildConfig) {
    throw new Error(
      `No build configuration has been found. It is a "[build]" section on you "${CONFIGFILE_NAME}" file.`
    );
  }

  const buildTarget =
    targetOverride ||
    (buildConfig.target in config.target ? config.target[buildConfig.target].target : buildConfig.target);

  if (!buildTarget) {
    throw new Error(
      `"target" field is missing in your ${CONFIGFILE_NAME} file. You can override the target with the "--target" option.`
    );
  }

  return buildTarget;
}

function getSourceFromConfig(source, target) {
  const config = getPackageConfig();
  const buildConfig = config.build;

  if (!buildConfig) {
    throw new Error(
      `No build configuration has been found. It is a "[build]" section on your "${CONFIGFILE_NAME}" file.`
    );
  }

  const buildSource =
    buildConfig.target in config.target ? config.target[buildConfig.target].directory : buildConfig.source;

  if (!buildSource) {
    throw new Error(`Could not find a source directory for ${target} in your ${CONFIGFILE_NAME} file.`);
  }

  return path.join(source, buildSource);
}

const build = async (source, dest, targetOverride, skipBundle) => {
  let progress = ora();
  const config = getPackageConfig(path.join(source, CONFIGFILE_NAME));
  const target = getBuildTarget(targetOverride, config);
  const destination = dest || getDestinationFromConfig(source, target, config);
  const sourceDir = getSourceFromConfig(source, target);

  info(`Creating build for ${target}`);
  try {
    progress.text = "Compiling...";
    progress.start();

    const files = getClioFiles(source);
    for (const file of files) {
      const relativeFile = path.relative(sourceDir, file);
      const destFile = path.join(destination, `${relativeFile}.js`);
      const destDir = path.dirname(destFile);
      const contents = fs.readFileSync(file, "utf8");
      const compiled = await generator(contents);
      const formatted = format(compiled, { parser: "babel" });
      mkdir(destDir);
      fs.writeFileSync(destFile, formatted, "utf8");
    }

    progress.succeed();
  } catch (e) {
    progress.fail();
    error(e, "Compilation");
    process.exit(3);
  }

  const nonClioFiles = getNonClioFiles(sourceDir);
  for (const file of nonClioFiles) {
    const relativeFile = path.relative(sourceDir, file);
    const destFile = path.join(destination, relativeFile);
    const destDir = path.dirname(destFile);
    mkdir(destDir);
    fs.copyFileSync(file, destFile);
  }

  const platform = getPlatform(target);
  if (!platform) {
    error(new Error(`Platform "${target}" is not supported.`), "Platform");
    process.exit(6);
  }

  try {
    progress.text = "Installing npm dependencies (this may take a while)...";
    progress.start();

    const packageJsonPath = path.join(destination, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      const dependencies = getParsedNpmDependencies(source);
      dependencies["clio-internals"] = "latest";
      const packageJsonContent = { dependencies };
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContent, null, 2));
    }

    if (!hasInstalledNpmDependencies(destination)) {
      await fetchNpmDependencies(destination);
    }

    progress.succeed();
  } catch (e) {
    progress.fail();
    error(e, "Dependency Install");
    process.exit(4);
  }

  try {
    await platform.build(destination, skipBundle);
  } catch (e) {
    error(e, "Bundling");
    process.exit(5);
  }
};

const command = "build [target] [source] [destination]";
const desc = "Build a Clio project";
const handler = argv => build(argv.source, argv.destination, argv.target, argv["skip-bundle"]);
const builder = {
  source: {
    describe: "source directory to read from",
    type: "string",
    default: path.resolve(".")
  },
  destination: {
    describe: "destination directory to write to",
    type: "string"
  },
  target: {
    describe: "An override for the default project target.",
    type: "string"
  },
  "skip-bundle": {
    describe: "Does not produces a bundle for browsers.",
    type: "boolean"
  }
};

module.exports = {
  build,
  command,
  desc,
  builder,
  handler,
  getBuildTarget,
  getDestinationFromConfig
};
