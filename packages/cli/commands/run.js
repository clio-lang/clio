const path = require("path");
const { getPlatform } = require("../lib/platforms");
const { getBuildTarget, getDestinationFromConfig, build } = require("./build");
const { getPackageConfig } = require("clio-manifest");
const { error } = require("../lib/colors");

exports.command = "run [project]";

exports.describe = "Compile and run Clio file";

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
  run(argv, argv._.slice(1));
};

async function run(argv, args, forkOptions = {}) {
  try {
    const configPath = path.join(argv.project, "clio.toml");

    await build(configPath, {
      skipBundle: true,
      silent: argv.silent,
      clean: argv.clean,
    });

    const config = getPackageConfig(configPath);
    const target = getBuildTarget(configPath, config);
    const destination = getDestinationFromConfig(configPath, config);
    const platform = getPlatform(target);

    return await platform.run(destination, args, forkOptions);
  } catch (e) {
    error(e);
  }
}

exports.run = run;
