const path = require("path");
const fs = require("fs");
const { getPlatform } = require("../lib/platforms");
const { getBuildTarget, getDestinationFromConfig, build } = require("./build");
const { getPackageConfig } = require("clio-manifest");
const { error } = require("../lib/colors");
const { isClioConfig, isDir } = require("./build"); // TODO: Move to lib
const { configPrompt } = require("../lib/config");

exports.command = "run [config]";

exports.describe = "Compile and run Clio file";

exports.builder = {
  config: {
    describe: "Config file, or a directory to read configs from.",
    type: "string",
    default: path.resolve("."),
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

exports.handler = (argv) => {
  run(argv, argv._.slice(1));
};

async function run(argv, args, forkOptions = {}) {
  try {
    const configFiles = isDir(argv.config)
      ? fs.readdirSync(argv.config).filter(isClioConfig)
      : [argv.config];

    const configPath =
      configFiles.length == 1
        ? configFiles[0]
        : await configPrompt(configFiles);

    await build(configPath, {
      skipBundle: true,
      silent: argv.silent,
      clean: argv.clean,
    });

    const config = getPackageConfig(configPath);
    const target = getBuildTarget(configPath, config);
    const destination = getDestinationFromConfig(configPath, config);
    const platform = getPlatform(target);

    if (!platform) {
      throw new Error(`Platform "${target}" is not supported.`);
    }

    return await platform.run(destination, args, forkOptions);
  } catch (e) {
    error(e);
  }
}

exports.run = run;
