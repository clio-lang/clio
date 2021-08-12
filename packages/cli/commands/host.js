const path = require("path");
const { getPlatform } = require("../lib/platforms");
const { getBuildTarget, getDestinationFromConfig, build } = require("./build");
const { getPackageConfig } = require("clio-manifest");
const { error } = require("../lib/colors");

exports.command = "host [project]";

exports.describe = "Compile and host Clio file";

exports.builder = {
  project: {
    describe: "Project root directory, where your clio.toml file is.",
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
  host(argv, argv._.slice(1));
};

async function host(argv, args) {
  try {
    const configPath = path.join(argv.project, "clio.toml");

    await build(configPath, {
      skipBundle: true,
      silent: argv.silent,
      clean: argv.clean,
    });

    const config = getPackageConfig(configPath);
    const target = getBuildTarget(configPath, config); // No target override
    const destination = getDestinationFromConfig(configPath, config);
    const platform = getPlatform(target);

    return await platform.host(destination, args);
  } catch (e) {
    error(e);
  }
}

exports.host = host;
