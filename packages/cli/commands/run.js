const path = require("path");
const { getPlatform } = require("../lib/platforms");
const { getBuildTarget, getDestinationFromConfig, build } = require("./build");
const { CONFIGFILE_NAME, getPackageConfig } = require("../../../package/index");
const { error } = require("../lib/colors");

exports.command = "run [source]";

exports.describe = "Compile and run Clio file";

exports.builder = {
  source: {
    describe: "source file to run",
    type: "string",
    default: path.resolve(".")
  }
};

exports.handler = argv => {
  run(argv.source);
};

async function run(projectPath) {
  try {
    await build(projectPath, null, { skipBundle: true });

    const config = getPackageConfig(path.join(projectPath, CONFIGFILE_NAME));
    const target = getBuildTarget(null, config); // No target override
    const destination = getDestinationFromConfig(projectPath, target, config);
    const platform = getPlatform(target);
    if (!platform) {
      throw new Error(`Platform "${target}" is not supported.`);
    }

    await platform.run(destination);
  } catch (e) {
    error(e);
  }
}

exports.run = run;
