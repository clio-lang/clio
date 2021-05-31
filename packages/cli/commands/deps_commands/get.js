const path = require("path");
const fs = require("fs");

const { fetchDependencies } = require("clio-manifest");
const { error } = require("../../lib/colors");
const { isClioConfig, isDir } = require("../build"); // TODO: Move to lib
const { configPrompt } = require("../../lib/config");

exports.command = "get [config]";
exports.desc = "Download every dependency listed in the package config file";
exports.builder = {
  config: {
    describe: "Config file, or a directory to read configs from.",
    type: "string",
    default: path.resolve("."),
  },
};
exports.handler = async (argv) => {
  const configs = isDir(argv.config)
    ? fs.readdirSync(argv.config).filter(isClioConfig)
    : [argv.config];

  try {
    const config =
      configs.length == 1 ? configs[0] : await configPrompt(configs);

    fetchDependencies(config);
  } catch (e) {
    error(e);
  }
};
