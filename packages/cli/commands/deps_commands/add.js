const path = require("path");
const fs = require("fs");

const { installDependency } = require("clio-manifest");
const { error } = require("../../lib/colors");
const { isClioConfig, isDir } = require("../build"); // TODO: Move to lib
const { configPrompt } = require("../../lib/config");

exports.command = "add <source> [config] [options]";
exports.desc = "Add a new dependency";
exports.builder = {
  source: { describe: "Source to analyze", type: "string" },
  config: {
    describe: "Config file, or a directory to read configs from.",
    type: "string",
    default: path.resolve("."),
  },
  npm: { describe: "Add NPM dependency", type: "boolean" },
  dev: { describe: "Add dev (NPM) dependency", type: "boolean" },
};
exports.handler = async (argv) => {
  const configs = isDir(argv.config)
    ? fs.readdirSync(argv.config).filter(isClioConfig)
    : [argv.config];

  try {
    const config =
      configs.length == 1 ? configs[0] : await configPrompt(configs);

    installDependency(config, argv.source, argv);
  } catch (e) {
    error(e);
  }
};
