const path = require("path");

const { fetchDependencies } = require("clio-manifest");
const { error } = require("../../lib/colors");

exports.command = "get [project]";
exports.desc = "Download every dependency listed in the package config file";
exports.builder = {
  project: {
    describe: "Project root directory, where your clio.toml file is.",
    type: "string",
    default: path.resolve("."),
  },
};
exports.handler = async (argv) => {
  try {
    const config = path.join(argv.project, "clio.toml");
    fetchDependencies(config);
  } catch (e) {
    error(e);
  }
};
